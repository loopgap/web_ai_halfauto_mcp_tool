import { Pause } from "lucide-react";
import type { DispatchOptions, InjectionMode } from "../types";

interface DispatchOptionsProps {
  options: DispatchOptions;
  onChange: (options: DispatchOptions) => void;
}

export default function DispatchOptions({ options, onChange }: DispatchOptionsProps) {
  const setOption = <K extends keyof DispatchOptions>(key: K, value: DispatchOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <>
      {/* 两阶段模式切换 */}
      <div className="flex items-center gap-3 px-4 py-2.5 glass-card-static">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={options.twoPhaseMode}
            onChange={(e) => setOption("twoPhaseMode", e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-500"
          />
          <Pause size={14} className="text-indigo-400" />
          {"两阶段提交"}
        </label>
        <span className="text-xs text-slate-500">
          {options.twoPhaseMode ? "仅粘贴，确认后发送" : "粘贴后自动回车发送"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 glass-card-static">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={options.autoBrowserSelect}
            onChange={(e) => setOption("autoBrowserSelect", e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-500"
          />
          {"浏览器智能选择"}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={options.autoInject}
            onChange={(e) => setOption("autoInject", e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-500"
          />
          {"自动指令注入"}
        </label>
        <label htmlFor="injection-mode" className="text-xs text-slate-400">{"注入模式"}</label>
        <select
          id="injection-mode"
          className="bg-[#060a14]/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
          value={options.injectionMode}
          onChange={(e) => setOption("injectionMode", e.target.value as InjectionMode)}
          disabled={!options.autoInject}
        >
          <option value="strict">{"注入严格"}</option>
          <option value="balanced">{"注入平衡"}</option>
          <option value="lean">{"注入简洁"}</option>
        </select>
      </div>
    </>
  );
}