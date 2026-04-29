import { type Node, type Edge } from '@xyflow/react';
import { X, Settings2, Type, Trash2 } from 'lucide-react';
import { type TargetNodeData } from './TargetNode';

/** 属性面板 Props */
interface PropertiesPanelProps {
  /** 当前选中的节点 */
  selectedNode: Node | null;
  /** 当前选中的边 */
  selectedEdge: Edge | null;
  /** 更新节点数据 */
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  /** 删除节点 */
  onDeleteNode: (nodeId: string) => void;
  /** 删除边 */
  onDeleteEdge: (edgeId: string) => void;
  /** 关闭面板 */
  onClose: () => void;
}

/**
 * PropertiesPanel - 节点/边属性编辑面板
 *
 * 当选中节点或边时显示，允许用户编辑属性
 */
export default function PropertiesPanel({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}: PropertiesPanelProps) {
  // 既没有选中节点也没有选中边，不显示面板
  if (!selectedNode && !selectedEdge) {
    return null;
  }

  const isTargetNode = selectedNode?.type === 'target';
  const nodeData = selectedNode?.data as TargetNodeData | undefined;

  return (
    <div className="bg-[#0a1020]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-xl w-[280px] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-indigo-400" />
          <span className="text-sm font-medium text-slate-200">
            {selectedNode ? '节点属性' : '边属性'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="关闭"
        >
          <X size={14} />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-4">
        {selectedNode && (
          <>
            {/* 节点 ID (只读) */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">节点 ID</label>
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 font-mono">
                {selectedNode.id}
              </div>
            </div>

            {/* 节点类型 (只读) */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">节点类型</label>
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400">
                {selectedNode.type || 'default'}
              </div>
            </div>

            {/* 节点名称 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Type size={12} />
                名称
              </label>
              <input
                type="text"
                value={nodeData?.label || ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { ...nodeData, label: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                placeholder="输入节点名称..."
              />
            </div>

            {/* TargetNode 特定属性 */}
            {isTargetNode && (
              <>
                {/* 窗口标题 */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">窗口标题</label>
                  <input
                    type="text"
                    value={nodeData?.windowTitle || ''}
                    onChange={(e) => onUpdateNode(selectedNode.id, { ...nodeData, windowTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                    placeholder="窗口标题..."
                  />
                </div>

                {/* 是否已配置 */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isConfigured"
                    checked={nodeData?.isConfigured || false}
                    onChange={(e) => onUpdateNode(selectedNode.id, { ...nodeData, isConfigured: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
                  />
                  <label htmlFor="isConfigured" className="text-sm text-slate-300">
                    已配置目标
                  </label>
                </div>
              </>
            )}

            {/* 删除按钮 */}
            <button
              onClick={() => onDeleteNode(selectedNode.id)}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm text-red-400 transition-colors"
            >
              <Trash2 size={14} />
              删除节点
            </button>
          </>
        )}

        {selectedEdge && (
          <>
            {/* 边 ID (只读) */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">边 ID</label>
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 font-mono">
                {selectedEdge.id}
              </div>
            </div>

            {/* 源节点 */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">源节点</label>
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400">
                {selectedEdge.source}
              </div>
            </div>

            {/* 目标节点 */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">目标节点</label>
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400">
                {selectedEdge.target}
              </div>
            </div>

            {/* 边标签 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Type size={12} />
                标签
              </label>
              <input
                type="text"
                value={(selectedEdge.label as string) || ''}
                onChange={(e) => {
                  // 注意：边的更新需要特殊处理
                  onUpdateNode(selectedEdge.id, { label: e.target.value });
                }}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                placeholder="边的标签..."
              />
            </div>

            {/* 删除按钮 */}
            <button
              onClick={() => onDeleteEdge(selectedEdge.id)}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm text-red-400 transition-colors"
            >
              <Trash2 size={14} />
              删除边
            </button>
          </>
        )}
      </div>
    </div>
  );
}
