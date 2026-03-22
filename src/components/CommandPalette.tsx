// ═══════════════════════════════════════════════════════════
// §74 Command Palette — 命令面板
// 单入口触发 Run/Capture/Preflight/Bind/Validate
// 支持最近命令与快捷键
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Zap, Terminal, Activity, Settings, Archive, GitBranch, Monitor } from "lucide-react";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category: string;
  /** 快捷键提示 */
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  /** 额外注入的命令 */
  extraCommands?: CommandItem[];
  /** 关闭回调 */
  onClose?: () => void;
  /** 外部控制打开状态 */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function CommandPalette({ extraCommands = [], onClose, externalOpen, onExternalOpenChange }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 同步外部 open 状态
  useEffect(() => {
    if (externalOpen !== undefined && externalOpen !== open) {
      setOpen(externalOpen);
    }
  }, [externalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── 内置命令 ─────
  const builtinCommands: CommandItem[] = useMemo(
    () => [
      {
        id: "nav-dashboard",
        label: "前往仪表盘",
        description: "查看总览与健康状态",
        icon: <Monitor size={16} />,
        category: "导航",
        action: () => navigate("/"),
      },
      {
        id: "nav-console",
        label: "前往运行控制台",
        description: "执行 Skill 与调度",
        icon: <Terminal size={16} />,
        category: "导航",
        shortcut: "Ctrl+Shift+C",
        action: () => navigate("/console"),
      },
      {
        id: "nav-targets",
        label: "前往 Targets 管理",
        description: "管理目标窗口绑定",
        icon: <Activity size={16} />,
        category: "导航",
        action: () => navigate("/targets"),
      },
      {
        id: "nav-skills",
        label: "前往 Skills 技能",
        description: "查看和管理 Skill",
        icon: <Zap size={16} />,
        category: "导航",
        action: () => navigate("/skills"),
      },
      {
        id: "nav-workflows",
        label: "前往 Workflows",
        description: "查看和执行 Workflow",
        icon: <GitBranch size={16} />,
        category: "导航",
        action: () => navigate("/workflows"),
      },
      {
        id: "nav-archive",
        label: "前往归档",
        description: "查看运行历史",
        icon: <Archive size={16} />,
        category: "导航",
        action: () => navigate("/archive"),
      },
      {
        id: "nav-settings",
        label: "前往设置",
        description: "配置与治理",
        icon: <Settings size={16} />,
        category: "导航",
        action: () => navigate("/settings"),
      },
    ],
    [navigate],
  );

  const allCommands = useMemo(
    () => [...builtinCommands, ...extraCommands],
    [builtinCommands, extraCommands],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        (cmd.description?.toLowerCase().includes(q)) ||
        cmd.category.toLowerCase().includes(q),
    );
  }, [allCommands, query]);

  // ───── 快捷键 Ctrl+K (仅当没有外部控制时处理) ─────
  useEffect(() => {
    if (externalOpen !== undefined) return; // 外部控制时不处理
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, externalOpen, handleClose]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onExternalOpenChange?.(false);
    setQuery("");
    onClose?.();
  }, [onClose, onExternalOpenChange]);

  const handleSelect = useCallback(
    (cmd: CommandItem) => {
      cmd.action();
      handleClose();
    },
    [handleClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      }
    },
    [filtered, selectedIndex, handleSelect],
  );

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); onExternalOpenChange?.(true); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-xs hover:bg-slate-700/50 transition-colors"
        aria-label="打开命令面板 (Ctrl+K)"
        title="Ctrl+K"
      >
        <Search size={14} />
        <span>命令面板</span>
        <kbd className="ml-2 px-1.5 py-0.5 bg-slate-900 rounded text-[10px] border border-slate-600">
          Ctrl+K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
    >
      <div
        className="w-full max-w-lg bg-[#0a0f1e]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.06] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <Search size={18} className="text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="输入命令名称..."
            className="flex-1 bg-transparent text-slate-200 text-sm outline-none placeholder:text-slate-500"
            aria-label="搜索命令"
            autoComplete="off"
          />
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 border border-slate-600">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto py-1"
          role="listbox"
          aria-label="命令列表"
        >
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              未找到匹配的命令
            </div>
          )}
          {filtered.map((cmd, index) => (
            <button
              key={cmd.id}
              onClick={() => handleSelect(cmd)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                index === selectedIndex
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-slate-300 hover:bg-white/[0.04]"
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span className="shrink-0 text-slate-400">{cmd.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{cmd.label}</div>
                {cmd.description && (
                  <div className="text-xs text-slate-500 truncate">{cmd.description}</div>
                )}
              </div>
              {cmd.shortcut && (
                <kbd className="shrink-0 px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-500 border border-slate-600">
                  {cmd.shortcut}
                </kbd>
              )}
              <span className="shrink-0 text-[10px] text-slate-600">{cmd.category}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-slate-500">
          <span>↑↓ 导航</span>
          <span>↵ 确认</span>
          <span>Esc 关闭</span>
          <span className="ml-auto">{filtered.length} 条命令</span>
        </div>
      </div>
    </div>
  );
}
