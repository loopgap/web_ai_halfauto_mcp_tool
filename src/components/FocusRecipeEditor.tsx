// ═══════════════════════════════════════════════════════════
// §9.7 Focus Recipe Editor — 焦点配方编辑器
// 为每个 provider 配置焦点配方 (示例: ESC, ESC, TAB, TAB)
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import { Plus, X, GripVertical, Play, RotateCcw } from "lucide-react";

const PRESET_KEYS = [
  "ESC",
  "TAB",
  "SHIFT+TAB",
  "ENTER",
  "SPACE",
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "HOME",
  "END",
  "CTRL+A",
  "ALT+TAB",
] as const;

interface FocusRecipeEditorProps {
  recipe: string[];
  onChange: (recipe: string[]) => void;
  /** 测试执行回调 */
  onTest?: (recipe: string[]) => void;
  disabled?: boolean;
}

export default function FocusRecipeEditor({
  recipe,
  onChange,
  onTest,
  disabled = false,
}: FocusRecipeEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addKey = useCallback(
    (key: string) => {
      onChange([...recipe, key]);
    },
    [recipe, onChange],
  );

  const removeKey = useCallback(
    (index: number) => {
      onChange(recipe.filter((_, i) => i !== index));
    },
    [recipe, onChange],
  );

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === targetIndex) return;
      const updated = [...recipe];
      const [item] = updated.splice(dragIndex, 1);
      updated.splice(targetIndex, 0, item);
      onChange(updated);
      setDragIndex(targetIndex);
    },
    [dragIndex, recipe, onChange],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-300">焦点配方 (Focus Recipe)</label>
        <div className="flex items-center gap-1">
          {onTest && recipe.length > 0 && (
            <button
              onClick={() => onTest(recipe)}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors disabled:opacity-40"
              title="测试执行配方"
            >
              <Play size={12} />
              测试
            </button>
          )}
          <button
            onClick={() => onChange([])}
            disabled={disabled || recipe.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/50 text-slate-400 rounded hover:bg-slate-700 transition-colors disabled:opacity-40"
            title="重置配方"
          >
            <RotateCcw size={12} />
            清空
          </button>
        </div>
      </div>

      {/* 当前序列 */}
      <div className="min-h-[40px] p-2 inner-panel rounded-xl flex flex-wrap gap-1.5">
        {recipe.length === 0 && (
          <span className="text-xs text-slate-500 py-1">点击下方按键添加焦点配方步骤...</span>
        )}
        {recipe.map((key, index) => (
          <div
            key={`${key}-${index}`}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-all ${
              dragIndex === index
                ? "bg-blue-600/30 border-blue-500 border"
                : "bg-white/[0.06] border border-white/[0.08] text-slate-200"
            } ${disabled ? "opacity-50" : "cursor-grab active:cursor-grabbing"}`}
          >
            <GripVertical size={10} className="text-slate-500" />
            <span>{key}</span>
            {!disabled && (
              <button
                onClick={() => removeKey(index)}
                className="ml-0.5 text-slate-500 hover:text-red-400 transition-colors"
                aria-label={`移除 ${key}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 预设按键 */}
      <div className="flex flex-wrap gap-1">
        {PRESET_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => addKey(key)}
            disabled={disabled}
            className="px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40"
          >
            <Plus size={10} className="inline mr-0.5" />
            {key}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-slate-500">
        拖拽调整顺序。激活窗口后先运行配方，再执行粘贴。§9.7
      </p>
    </div>
  );
}
