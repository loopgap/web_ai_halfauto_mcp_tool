import { useState, useCallback } from "react";
import { useAppState, useAppDispatch } from "../store/AppStore";
import { saveTargetsFlow } from "../domain/actions";
import { enumWindows, healthCheck } from "../api";
import type { WindowInfo, TargetsConfig } from "../types";
import { SkeletonCard, SkeletonList } from "../components/Skeleton";
import TargetWizard from "../components/TargetWizard";
import {
  Monitor,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
} from "lucide-react";

export default function TargetsPage() {
  const { targets, health, initialized, pageStates } = useAppState();
  const dispatch = useAppDispatch();

  const [localConfig, setLocalConfig] = useState<TargetsConfig | null>(null);
  const [systemWindows, setSystemWindows] = useState<WindowInfo[]>([]);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const pageState = pageStates.targets || "idle";
  const config = localConfig ?? targets;

  const handleExplore = async () => {
    try {
      const wins = await enumWindows(false);
      setSystemWindows(wins);
      setShowExplorer(true);
    } catch (e) {
      console.error(e);
    }
  };

  // §9.2 启动验证粘贴向导
  const handleWizard = async () => {
    try {
      const wins = await enumWindows(false);
      setSystemWindows(wins);
      setShowWizard(true);
    } catch (e) {
      console.error(e);
    }
  };

  // §9.2 向导完成: verified=true 则添加, verified=false 则不落库
  const handleWizardComplete = (win: WindowInfo, verified: boolean) => {
    if (verified) {
      addTarget(win);
    } else {
      console.warn("[§9.2] 粘贴验证未通过, target 未添加:", win.title);
    }
    setShowWizard(false);
  };

  const handleHealthCheck = useCallback(async () => {
    try {
      const h = await healthCheck();
      dispatch({ type: "SET_HEALTH", payload: h });
    } catch (e) {
      console.error(e);
    }
  }, [dispatch]);

  const handleSave = useCallback(async () => {
    if (!config) return;
    await saveTargetsFlow(config, dispatch);
    setLocalConfig(null);
  }, [config, dispatch]);

  const addTarget = (win: WindowInfo) => {
    if (!config) return;
    const id = `target_${Date.now()}`;
    const escaped = win.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = escaped.substring(0, 30) + ".*";

    // §9.1 多因子指纹绑定
    setLocalConfig({
      ...config,
      targets: {
        ...config.targets,
        [id]: {
          provider: "custom",
          match: {
            title_regex: [regex],
            bound_hwnd: win.hwnd,
            exe_name: win.exe_name ?? undefined,
            class_name: win.class_name || undefined,
            process_id: win.process_id || undefined,
          },
          behavior: {
            auto_enter: false,
            paste_delay_ms: 80,
            restore_clipboard_after_paste: false,
            focus_recipe: [],
            append_run_watermark: true,
          },
        },
      },
    });
    setShowExplorer(false);
  };

  const removeTarget = (id: string) => {
    if (!config) return;
    const newTargets = { ...config.targets };
    delete newTargets[id];
    setLocalConfig({ ...config, targets: newTargets });
  };

  if (!initialized) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonCard lines={2} />
        <SkeletonList count={3} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Targets 管理</h2>
          <p className="text-slate-400 mt-1">
            管理目标窗口注册、健康检查、窗口探测
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleWizard}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            添加向导
          </button>
          <button
            onClick={handleExplore}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Eye size={16} />
            窗口探测器
          </button>
          <button
            onClick={handleHealthCheck}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-sm hover:bg-[#263548] transition-colors"
          >
            <RefreshCw size={16} />
            健康检查
          </button>
          <button
            onClick={handleSave}
            disabled={pageState === "saving"}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pageState === "saving" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            {pageState === "saving" ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      {/* Health Status */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Monitor size={20} className="text-blue-400" />
          健康状态
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {health.map((h) => (
            <div
              key={h.target_id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                h.status === "ready"
                  ? "bg-green-900/20 border-green-800/50"
                  : h.status === "missing"
                  ? "bg-red-900/20 border-red-800/50"
                  : h.status === "ambiguous"
                  ? "bg-yellow-900/20 border-yellow-800/50"
                  : "bg-orange-900/20 border-orange-800/50"
              }`}
            >
              {h.status === "ready" ? (
                <CheckCircle size={18} className="text-green-400" />
              ) : h.status === "ambiguous" ? (
                <AlertCircle size={18} className="text-yellow-400" />
              ) : (
                <XCircle size={18} className="text-red-400" />
              )}
              <div>
                <div className="text-sm font-medium">{h.target_id}</div>
                <div className="text-xs text-slate-500">
                  {h.provider} · {h.status}
                  {h.matched_hwnd ? ` · hwnd:${h.matched_hwnd}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Targets List */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <h3 className="text-lg font-semibold mb-4">已注册 Targets</h3>
        <div className="space-y-3">
          {config &&
            Object.entries(config.targets).map(([id, target]) => (
              <div
                key={id}
                className="bg-[#0f172a] rounded-lg p-4 border border-[#334155]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{id}</span>
                    <span className="text-xs px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded">
                      {target.provider}
                    </span>
                  </div>
                  <button
                    onClick={() => removeTarget(id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  {target.match.title_regex.map((r, i) => (
                    <div key={i} className="font-mono bg-[#1e293b] px-2 py-1 rounded">
                      {r}
                    </div>
                  ))}
                  {/* §9.1 多因子指纹 */}
                  {(target.match.bound_hwnd || target.match.exe_name || target.match.class_name) && (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {target.match.bound_hwnd && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-600/20 text-purple-300 rounded">
                          hwnd:{target.match.bound_hwnd}
                        </span>
                      )}
                      {target.match.exe_name && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-600/20 text-cyan-300 rounded">
                          exe:{target.match.exe_name}
                        </span>
                      )}
                      {target.match.class_name && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-teal-600/20 text-teal-300 rounded">
                          class:{target.match.class_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                  <span>
                    auto_enter: {target.behavior.auto_enter ? "是" : "否"}
                  </span>
                  <span>paste_delay: {target.behavior.paste_delay_ms}ms</span>
                  <span>
                    clipboard_restore: {target.behavior.restore_clipboard_after_paste ? "是" : "否"}
                  </span>
                  <span>
                    watermark: {target.behavior.append_run_watermark ? "是" : "否"}
                  </span>
                  {target.behavior.focus_recipe.length > 0 && (
                    <span>
                      focus_recipe: [{target.behavior.focus_recipe.join(", ")}]
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Window Explorer Modal */}
      {showExplorer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] rounded-2xl border border-[#334155] p-6 w-[700px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">窗口探测器</h3>
              <button
                onClick={() => setShowExplorer(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              检测到 {systemWindows.length} 个窗口，点击 + 添加为 Target
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-auto">
              {systemWindows
                .filter((w) => w.title.length > 0)
                .map((w) => (
                  <div
                    key={w.hwnd}
                    className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg hover:bg-[#162032] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{w.title}</div>
                      <div className="text-xs text-slate-500">
                        HWND: {w.hwnd} | PID: {w.process_id} | Class: {w.class_name}
                      </div>
                    </div>
                    <button
                      onClick={() => addTarget(w)}
                      className="ml-3 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
                    >
                      <Plus size={14} />
                      添加
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* §9.2 Target Setup Wizard */}
      {showWizard && (
        <TargetWizard
          windows={systemWindows}
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}