// ═══════════════════════════════════════════════════════════
// §38 Event Bus — Tauri "workbench-event" 前端订阅
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Dispatch } from "react";
import type { AppAction } from "../store/AppStore";
import type {
  ChangeRecord,
  QualityGateResult,
  ReleaseDecisionRecord,
  GovernanceValidationReport,
} from "../types";

/** 后端通过 app_handle.emit("workbench-event", payload) 发出的事件结构 */
export interface WorkbenchEvent {
  event_type: string;
  run_id?: string;
  step_id?: string;
  target_id?: string;
  trace_id?: string;
  ts_ms?: number;
  stage_ok?: boolean;
  status?: string;
  artifact_id?: string;
  error_code?: string;
  change?: unknown;
  quality?: unknown;
  decision?: unknown;
  report?: unknown;
  [key: string]: unknown;
}

/** §38 事件处理回调（供外部扩展） */
export type EventSideEffect = (event: WorkbenchEvent) => void;

/**
 * 订阅 "workbench-event" Tauri 全局事件，
 * 根据 event_type 分发到 store action 或执行副作用。
 * @returns unsubscribe function to manually clean up the subscription
 */
export function useEventBus(dispatch: Dispatch<AppAction>, sideEffects?: EventSideEffect): () => void {
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const sideEffectRef = useRef(sideEffects);
  sideEffectRef.current = sideEffects;
  const cleanupRef = useRef({ cancelled: false, unlisten: null as UnlistenFn | null });

  // §E2 事件序列化队列 - 确保事件顺序处理，防止并发状态更新覆盖
  const eventQueue = useRef<WorkbenchEvent[]>([]);
  const isProcessing = useRef(false);

  /** 队列背压机制：队列最大长度，防止内存泄漏 */
  const MAX_QUEUE_SIZE = 1000;

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    /** §E2 从队列中处理单个事件 */
    const handleEvent = (payload: WorkbenchEvent, d: Dispatch<AppAction>, sideEffect: EventSideEffect | undefined) => {
      switch (payload.event_type) {
          // ──── Run lifecycle events ────
          case "RunCreated":
          case "RunUpdated":
          case "RunDispatched":
          case "RunDone":
          case "RunFailed":
          case "RunClosed":
            if (payload.run_id && payload.status) {
              d({
                type: "UPDATE_RUN",
                payload: {
                  id: payload.run_id,
                  updates: { status: payload.status as RunStatus },
                },
              });
            }
            break;

          // ──── Step lifecycle events (§37/§38) ────
          case "StepDispatched":
            if (payload.run_id) {
              sideEffect?.(payload);
            }
            break;

          case "StepCaptured":
            // §37 step 采集完成 → 更新 run 状态 + 自动推进下一步
            if (payload.run_id && payload.step_id) {
              d({
                type: "UPDATE_RUN",
                payload: {
                  id: payload.run_id,
                  updates: { status: "captured" as RunStatus },
                },
              });
              // §37 自动推进: 通过 sideEffect 通知 UI 层准备下一步
              // ConsolePage 会监听此事件，查找 workflow 中的下一步并自动渲染
              sideEffectRef.current?.({
                ...payload,
                event_type: "StepCaptured:auto_advance",
              });
              sideEffect?.(payload);
            }
            break;

          // ──── Additional Step lifecycle events (§38) ────
          case "StepAwaitingSend":
          case "StepWaitingOutput":
            if (payload.run_id) {
              sideEffect?.(payload);
            }
            break;

          case "ClipboardCaptured":
          case "NewFileInInbox":
          case "NewSourceFetched":
            sideEffect?.(payload);
            break;

          case "StepFailed":
            // §37 step 失败 → 标记 run 出错
            if (payload.run_id) {
              d({
                type: "UPDATE_RUN",
                payload: {
                  id: payload.run_id,
                  updates: {
                    status: "failed" as RunStatus,
                    error_code: payload.error_code,
                  },
                },
              });
              d({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
              sideEffect?.(payload);
            }
            break;

          // ──── Target events ────
          case "TargetMissing":
            // §9.3 目标丢失 → 触发副作用（toast 通知等）
            sideEffect?.(payload);
            break;

          case "TargetRebound":
            // 目标重绑成功
            sideEffect?.(payload);
            break;

          // ──── Artifact events ────
          case "ArtifactSaved":
            sideEffect?.(payload);
            break;

          // ═══ Governance events ═══
          case "GovernanceUpdated":
            if (payload.change && typeof payload.change === "object") {
              d({ type: "UPSERT_GOV_CHANGE", payload: payload.change as ChangeRecord });
            }
            if (payload.quality && typeof payload.quality === "object") {
              d({ type: "UPSERT_GOV_QUALITY", payload: payload.quality as QualityGateResult });
            }
            if (payload.decision && typeof payload.decision === "object") {
              d({ type: "UPSERT_GOV_DECISION", payload: payload.decision as ReleaseDecisionRecord });
            }
            sideEffect?.(payload);
            break;

          case "GovernanceValidation":
            if (payload.report && typeof payload.report === "object") {
              d({ type: "ADD_GOV_REPORT", payload: payload.report as GovernanceValidationReport });
            }
            sideEffect?.(payload);
            break;

          case "TelemetryEmitted":
            sideEffect?.(payload);
            break;

          default:
            // 未知事件静默忽略（生产环境不 console.debug）
            break;
      }
    };

    /** §E2 处理事件队列，串行执行 */
    const processQueue = async () => {
      if (isProcessing.current || eventQueue.current.length === 0) return;
      isProcessing.current = true;

      while (eventQueue.current.length > 0) {
        const event = eventQueue.current.shift();
        if (event) {
          handleEvent(event, dispatchRef.current, sideEffectRef.current);
        }
      }

      isProcessing.current = false;
    };

    const setup = async () => {
      const fn = await listen<WorkbenchEvent>("workbench-event", (event) => {
        // §E2 事件入队，异步串行处理
        // §E2 背压机制：队列满时移除最旧事件，异步发出 QUEUE_OVERFLOW 警告
        if (eventQueue.current.length >= MAX_QUEUE_SIZE) {
          const overflowEvent: WorkbenchEvent = {
            event_type: "QUEUE_OVERFLOW",
            message: `Event queue overflow: removed oldest event. Queue size: ${MAX_QUEUE_SIZE}`,
            oldest_event: eventQueue.current.shift(),
          };
          // 异步发出警告，不阻塞事件发送者
          setTimeout(() => sideEffectRef.current?.(overflowEvent), 0);
        }
        eventQueue.current.push(event.payload);
        processQueue();
      });
      // Guard: if component unmounted while listen() was pending, clean up immediately
      if (cleanupRef.current.cancelled) {
        fn();
      } else {
        unlisten = fn;
        cleanupRef.current.unlisten = unlisten;
      }
    };

    setup();

    return () => {
      cleanupRef.current.cancelled = true;
      if (cleanupRef.current.unlisten) cleanupRef.current.unlisten();
      // §E2 清理队列，防止内存泄漏
      eventQueue.current = [];
    };
  }, []);

  return () => {
    cleanupRef.current.cancelled = true;
    if (cleanupRef.current.unlisten) cleanupRef.current.unlisten();
  };
}

// §37 完整 RunStatus（对齐 route.md §10 状态机）
type RunStatus =
  | "created"
  | "dispatched"
  | "waiting_capture"
  | "waiting_output"
  | "captured"
  | "done"
  | "failed"
  | "closed"
  | "cancelled"
  | "compensating";
