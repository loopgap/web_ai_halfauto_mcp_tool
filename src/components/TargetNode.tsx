import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Monitor, Settings2, GripVertical } from 'lucide-react';

/** TargetNode 节点数据格式 */
export interface TargetNodeData {
  label: string;
  targetId?: string;
  windowTitle?: string;
  isConfigured?: boolean;
  /** 是否选中以便编辑 */
  selected?: boolean;
  [key: string]: unknown;
}

/**
 * TargetNode - 工作流中的目标节点组件
 *
 * 功能：
 * - 显示目标窗口信息
 * - 提供输入/输出连接点
 * - 支持选中状态下的配置编辑
 *
 * @note 完整的 TargetWizard 逻辑通过双击节点触发
 */
function TargetNode({ data, selected }: NodeProps) {
  const nodeData = data as TargetNodeData;
  const { label, windowTitle, isConfigured } = nodeData;

  return (
    <div
      className={`
        relative bg-[#0a1020]/95 backdrop-blur-sm border rounded-xl shadow-xl transition-all duration-200
        ${selected
          ? 'border-indigo-500 shadow-indigo-500/20 ring-2 ring-indigo-500/30'
          : 'border-white/10 hover:border-white/20'
        }
        min-w-[180px]
      `}
    >
      {/* 输入 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-600 !border-2 !border-slate-400 hover:!bg-indigo-400 hover:!border-indigo-400 transition-colors"
      />

      {/* 节点内容 */}
      <div className="p-3">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
            <Monitor size={14} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">
              {label || '未命名目标'}
            </div>
            {windowTitle && (
              <div className="text-[10px] text-slate-500 truncate" title={windowTitle}>
                {windowTitle}
              </div>
            )}
          </div>
          <GripVertical size={14} className="text-slate-600 cursor-grab" />
        </div>

        {/* 状态指示器 */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
            isConfigured
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              isConfigured ? 'bg-emerald-400' : 'bg-amber-400'
            }`} />
            {isConfigured ? '已配置' : '待配置'}
          </div>

          {selected && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 ml-auto">
              <Settings2 size={10} />
              编辑中
            </div>
          )}
        </div>
      </div>

      {/* 输出 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-600 !border-2 !border-slate-400 hover:!bg-indigo-400 hover:!border-indigo-400 transition-colors"
      />
    </div>
  );
}

/** 使用 memo 优化渲染性能 */
export default memo(TargetNode);
