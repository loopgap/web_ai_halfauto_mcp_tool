import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Zap,
  GitBranch,
  Monitor,
  Archive,
  Settings,
  Activity,
  Loader2,
} from "lucide-react";
import { useAppState, useAppDispatch } from "../store/AppStore";
import { initializeApp } from "../domain/actions";
import CommandPalette from "./CommandPalette";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/skills", icon: Zap, label: "Skills 技能" },
  { to: "/workflows", icon: GitBranch, label: "Workflows" },
  { to: "/console", icon: Monitor, label: "运行控制台" },
  { to: "/archive", icon: Archive, label: "Runs 归档" },
  { to: "/targets", icon: Activity, label: "Targets 管理" },
  { to: "/settings", icon: Settings, label: "设置" },
];

export default function Layout() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!state.initialized) {
      initializeApp(dispatch);
    }
  }, [state.initialized, dispatch]);

  if (!state.initialized && state.pageStates.dashboard === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
          <span>加载配置...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0c1222] border-r border-[#1e293b] flex flex-col">
        <div className="p-4 border-b border-[#1e293b]">
          <h1 className="text-lg font-bold text-blue-400">AI Workbench</h1>
          <p className="text-xs text-slate-500 mt-1">多模型网页端调度器</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 font-medium"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[#1e293b]">
          {state.lastError && (
            <div className="text-xs text-red-400 mb-2 truncate" title={state.lastError.message}>
              ⚠ {state.lastError.code}
            </div>
          )}
          <div className="text-xs text-slate-600">v0.3.0 · Tauri v2 · Schema v3</div>
        </div>
      </aside>

      {/* Main Content — §49 布局约束 */}
      <main className="flex-1 overflow-auto">
        {/* §74 Command Palette */}
        <div className="sticky top-0 z-40 bg-[#0f172a]/80 backdrop-blur-sm border-b border-[#1e293b] px-4 py-2 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {state.lastError && <span className="text-red-400">⚠ {state.lastError.code}</span>}
          </div>
          <CommandPalette />
        </div>
        <div className="main-content-area p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
