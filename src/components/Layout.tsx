import { useEffect, useState, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Zap,
  GitBranch,
  Monitor,
  Archive,
  Settings,
  Activity,
  Loader2,
  Sparkles,
  Search,
} from "lucide-react";
import { useAppDispatch, useAppStore } from '../store/AppStore';
import { initializeApp } from "../domain/actions";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import CommandPalette from "./CommandPalette";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘", desc: "总览" },
  { to: "/skills", icon: Zap, label: "Skills", desc: "技能库" },
  { to: "/workflows", icon: GitBranch, label: "Workflows", desc: "工作流" },
  { to: "/console", icon: Monitor, label: "Console", desc: "控制台" },
  { to: "/archive", icon: Archive, label: "Archive", desc: "归档" },
  { to: "/targets", icon: Activity, label: "Targets", desc: "管理" },
  { to: "/settings", icon: Settings, label: "Settings", desc: "设置" },
];

const pageTitle: Record<string, string> = {
  "/": "仪表盘",
  "/skills": "Skills 技能库",
  "/workflows": "Workflows 工作流",
  "/console": "运行控制台",
  "/archive": "Runs 归档",
  "/targets": "Targets 管理",
  "/settings": "系统设置",
};

export default function Layout() {
  const state = useAppStore();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    if (!state.initialized) {
      initializeApp(dispatch);
    }
  }, [state.initialized, dispatch]);

  // 全局快捷键
  useKeyboardShortcuts([
    { key: "ctrl+k",       handler: () => setCmdOpen(true) },
    { key: "ctrl+shift+k", handler: () => setCmdOpen(true) },
    { key: "ctrl+1",       handler: () => navigate("/") },
    { key: "ctrl+2",       handler: () => navigate("/skills") },
    { key: "ctrl+3",       handler: () => navigate("/workflows") },
    { key: "ctrl+4",       handler: () => navigate("/console") },
    { key: "ctrl+5",       handler: () => navigate("/archive") },
    { key: "ctrl+6",       handler: () => navigate("/targets") },
    { key: "ctrl+,",       handler: () => navigate("/settings") },
  ]);

  if (!state.initialized && state.pageStates.dashboard === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse-glow">
              <Sparkles size={24} className="text-white" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">正在初始化...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg">
        跳转到主内容
      </a>
      {/* ── 现代 Sidebar ── */}
      <aside role="navigation" aria-label="主导航" className="w-[240px] flex flex-col border-r border-white/[0.06] bg-[#060a14]/80 backdrop-blur-xl shrink-0">
        {/* Logo */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-gradient">AI Workbench</h1>
              <p className="text-[10px] text-slate-500 tracking-wide">Multi-Model Orchestrator</p>
            </div>
          </div>
        </div>

        <div className="divider-glow mx-4" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              aria-label={`${item.label} - ${item.desc}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                  isActive
                    ? "bg-indigo-500/10 text-indigo-300"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="nav-indicator" />}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isActive ? "bg-indigo-500/20" : "bg-white/[0.04] group-hover:bg-white/[0.06]"
                  }`}>
                    <item.icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{item.desc}</div>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-4 space-y-3">
          <div className="divider-glow" />
          {state.lastError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px] text-red-400 truncate" title={state.lastError.message}>
                {state.lastError.code}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-600">
            <span>v0.3.0</span>
            <span>Tauri v2</span>
            <span>Schema v3</span>
          </div>
        </div>
      </aside>

      {/* ── 主区域 ── */}
      <main id="main-content" className="flex-1 overflow-auto bg-gradient-to-b from-[#080d1a] to-[#0a1020]">
        {/* Header Bar */}
        <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#080d1a]/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-slate-200">
                {pageTitle[location.pathname] || "AI Workbench"}
              </h2>
              {state.lastError && (
                <span className="badge badge-red text-[10px]">
                  {state.lastError.code}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-500 text-xs cursor-pointer hover:bg-white/[0.06] transition-colors"
                   onClick={() => setCmdOpen(true)}
                   role="button"
                   tabIndex={0}
                   onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCmdOpen(true); }}>
                <Search size={13} />
                <span>搜索命令...</span>
                <kbd className="ml-4 px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-slate-500 font-mono">Ctrl K</kbd>
              </div>
              <CommandPalette
                externalOpen={cmdOpen}
                onExternalOpenChange={setCmdOpen}
              />
            </div>
          </div>
        </div>
        <div className="main-content-area p-0">
          <PageTransition pathname={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>
    </div>
  );
}

/** 页面切换过渡动画 — 路由变化时触发 page-enter 动画 */
function PageTransition({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname && ref.current) {
      ref.current.classList.remove("page-enter");
      // force reflow
      void ref.current.offsetWidth;
      ref.current.classList.add("page-enter");
      prevPath.current = pathname;
    }
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}
