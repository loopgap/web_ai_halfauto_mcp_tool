import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, Settings2, GripVertical, Plug } from 'lucide-react';

/** McpNode 节点数据格式 */
export interface McpNodeData {
  label: string;
  serverName?: string;
  serverVersion?: string;
  isConnected?: boolean;
  tools?: string[];
  /** 是否选中以便编辑 */
  selected?: boolean;
  [key: string]: unknown;
}

/**
 * McpNode - 工作流中的 MCP 节点组件
 *
 * 功能：
 * - 显示 MCP Server 连接信息
 * - 提供输入/输出连接点
 * - 支持选中状态下的配置编辑
 *
 * @note MCP 连接逻辑通过 McpClient 处理
 */
function McpNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as McpNodeData;
  const { label, serverName, serverVersion, isConnected, tools } = nodeData;

  return (
    <div
      className={`
        relative bg-[#0a1020]/95 backdrop-blur-sm border rounded-xl shadow-xl transition-all duration-200
        ${selected
          ? 'border-emerald-500 shadow-emerald-500/20 ring-2 ring-emerald-500/30'
          : 'border-white/10 hover:border-white/20'
        }
        min-w-[180px]
      `}
    >
      {/* 输入 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-600 !border-2 !border-slate-400 hover:!bg-emerald-400 hover:!border-emerald-400 transition-colors"
      />

      {/* 节点内容 */}
      <div className="p-3">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
            <Bot size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">
              {label || 'MCP 节点'}
            </div>
            {serverName && (
              <div className="text-[10px] text-slate-500 truncate" title={serverName}>
                {serverName} v{serverVersion || '?'}
              </div>
            )}
          </div>
          <GripVertical size={14} className="text-slate-600 cursor-grab" />
        </div>

        {/* 状态指示器 */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
            }`} />
            {isConnected ? '已连接' : '未连接'}
          </div>

          {selected && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-auto">
              <Settings2 size={10} />
              编辑中
            </div>
          )}
        </div>

        {/* 工具数量指示 */}
        {tools && tools.length > 0 && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
            <Plug size={10} />
            {tools.length} 个工具
          </div>
        )}
      </div>

      {/* 输出 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-600 !border-2 !border-slate-400 hover:!bg-emerald-400 hover:!border-emerald-400 transition-colors"
      />
    </div>
  );
}

/** 使用 memo 优化渲染性能 */
export default memo(McpNode);