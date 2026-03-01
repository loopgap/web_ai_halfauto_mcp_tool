// ═══════════════════════════════════════════════════════════
// §51 统一状态文案字典 — 所有 UI 文案从此处读取
// ═══════════════════════════════════════════════════════════

/** 页面状态 → 用户可读文案 */
export const PAGE_STATE_LABELS: Record<string, string> = {
  idle: "就绪",
  loading: "加载中",
  ready: "就绪",
  editing: "编辑中",
  saving: "保存中",
  validating: "校验中",
  dispatching: "投递中",
  waiting_capture: "等待回收",
  archived: "已归档",
  error: "出错",
};

/** Run 状态 → 用户可读文案 + 颜色 token */
export const RUN_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  created: { label: "已创建", color: "text-slate-300", dot: "bg-slate-400" },
  dispatched: { label: "已投递", color: "text-yellow-300", dot: "bg-yellow-400" },
  waiting_output: { label: "等待输出", color: "text-blue-300", dot: "bg-blue-400" },
  captured: { label: "已回收", color: "text-green-300", dot: "bg-green-400" },
  done: { label: "完成", color: "text-green-300", dot: "bg-green-400" },
  failed: { label: "失败", color: "text-red-300", dot: "bg-red-400" },
  closed: { label: "已关闭", color: "text-slate-400", dot: "bg-slate-500" },
  cancelled: { label: "已取消", color: "text-slate-400", dot: "bg-slate-500" },
};

/** TargetStatus → 用户可读文案 */
export const TARGET_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  ready: { label: "就绪", color: "text-green-300", dot: "bg-green-400" },
  missing: { label: "未找到", color: "text-red-300", dot: "bg-red-400" },
  ambiguous: { label: "多匹配", color: "text-yellow-300", dot: "bg-yellow-400" },
  needs_rebind: { label: "需重绑", color: "text-orange-300", dot: "bg-orange-400" },
  inactive: { label: "未激活", color: "text-slate-400", dot: "bg-slate-400" },
};

/** StepStatus → 用户可读文案 */
export const STEP_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "等待中", color: "text-slate-300" },
  dispatched: { label: "已调度", color: "text-blue-300" },
  awaiting_send: { label: "待发送", color: "text-yellow-300" },
  waiting_output: { label: "等待输出", color: "text-purple-300" },
  captured: { label: "已回收", color: "text-green-300" },
  failed: { label: "失败", color: "text-red-300" },
};

/** §45 调度阶段进度 */
export const DISPATCH_STAGES = [
  { key: "preflight", label: "预检查" },
  { key: "route", label: "路由决策" },
  { key: "stage", label: "粘贴暂存" },
  { key: "confirm", label: "确认发送" },
  { key: "capture", label: "输出回收" },
  { key: "archive", label: "归档落盘" },
] as const;

/** PageState → 当前调度阶段索引 (-1 = 未开始) */
export function getDispatchStageIndex(pageState: string): number {
  switch (pageState) {
    case "validating": return 0; // preflight
    case "dispatching": return 2; // stage
    case "waiting_capture": return 4; // capture
    case "archived": return 5; // archive
    default: return -1;
  }
}

/** §42.1 自动化级别 */
export const AUTOMATION_LEVELS: Record<string, { label: string; desc: string }> = {
  auto: { label: "自动", desc: "低风险操作自动执行" },
  assist: { label: "辅助", desc: "给出默认建议，倒计时执行" },
  confirm: { label: "确认", desc: "必须人工确认后才执行" },
};

/** §60 浏览器名称字典 — UI 展示用 */
export const BROWSER_LABELS: Record<string, { label: string; icon: string }> = {
  firefox: { label: "Firefox", icon: "🦊" },
  chrome: { label: "Chrome", icon: "🌐" },
  chromium: { label: "Chromium", icon: "🌐" },
  edge: { label: "Edge", icon: "🔵" },
  brave: { label: "Brave", icon: "🦁" },
  opera: { label: "Opera", icon: "🔴" },
  vivaldi: { label: "Vivaldi", icon: "🎵" },
  arc: { label: "Arc", icon: "🌈" },
  waterfox: { label: "Waterfox", icon: "🌊" },
  librewolf: { label: "LibreWolf", icon: "🐺" },
  floorp: { label: "Floorp", icon: "🐬" },
  tor: { label: "Tor Browser", icon: "🧅" },
  other: { label: "未知浏览器", icon: "❓" },
};
