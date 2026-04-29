import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TargetNode, { type TargetNodeData } from './TargetNode';
import McpNode, { type McpNodeData } from './McpNode';
import PropertiesPanel from './PropertiesPanel';

/** 节点类型映射 */
const nodeTypesMap: NodeTypes = {
  target: TargetNode,
  mcp: McpNode,
};

/** 可拖拽到画布的节点类型 */
const nodeTypes = ['input', 'default', 'output', 'target', 'mcp'];

/** 示例节点数据 */
const initialNodes: Node[] = [
  {
    id: '1',
    position: { x: 100, y: 100 },
    data: { label: '输入节点' },
    type: 'input',
  },
  {
    id: '2',
    position: { x: 300, y: 200 },
    data: { label: '处理节点' },
  },
  {
    id: '3',
    position: { x: 500, y: 100 },
    data: { label: '输出节点' },
    type: 'output',
  },
  {
    id: '4',
    position: { x: 300, y: 400 },
    data: {
      label: '示例目标',
      windowTitle: 'Visual Studio Code',
      isConfigured: true,
    } as unknown as TargetNodeData,
    type: 'target',
  },
  {
    id: '5',
    position: { x: 500, y: 300 },
    data: {
      label: 'MCP Server',
      serverName: 'ai-workbench-mcp',
      serverVersion: '0.1.0',
      isConnected: true,
      tools: ['ping', 'echo'],
    } as unknown as McpNodeData,
    type: 'mcp',
  },
];

/** 默认边样式配置 */
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { stroke: '#6366f1', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
};

/**
 * WorkflowEditor - React Flow 工作流编辑器基础组件
 *
 * 提供：
 * - 可缩放/平移的画布
 * - 拖拽添加节点能力
 * - 节点和边的基本操作
 * - 自定义 TargetNode 节点类型
 * - 属性面板编辑
 * - 连线数据校验
 *
 * @note 工作流保存/加载留给 Task 2.4
 */
export default function WorkflowEditor() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);

  // 选中的节点和边
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  /** 处理节点变化（拖拽、选择等） */
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  /** 处理边变化（选择等） */
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  /** 连线校验 - 防止循环连接和自连接 */
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      // 防止自连接
      if ('source' in connection && 'target' in connection && connection.source === connection.target) {
        return false;
      }

      // 防止重复连接
      const source = 'source' in connection ? connection.source : null;
      const target = 'target' in connection ? connection.target : null;
      if (source && target) {
        const exists = edges.some(
          (e) => e.source === source && e.target === target
        );
        if (exists) {
          return false;
        }
      }

      return true;
    },
    [edges]
  );

  /** 处理节点连接 */
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    []
  );

  /** 节点选中处理 */
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  /** 边选中处理 */
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  /** 点击空白处取消选中 */
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  /** 从面板拖拽节点到画布 */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  /** 处理放下节点 */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !nodeTypes.includes(type)) {
        return;
      }

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 75,
        y: event.clientY - reactFlowBounds.top - 25,
      };

      let nodeData: Record<string, unknown> = { label: `${type} 节点` };

      // TargetNode 特殊数据
      if (type === 'target') {
        nodeData = {
          label: '新目标',
          windowTitle: '未选择窗口',
          isConfigured: false,
        } as unknown as TargetNodeData;
      }

      // McpNode 特殊数据
      if (type === 'mcp') {
        nodeData = {
          label: 'MCP 节点',
          serverName: 'ai-workbench-mcp',
          serverVersion: '0.1.0',
          isConnected: false,
          tools: [],
        } as unknown as McpNodeData;
      }

      const newNode: Node = {
        id: `${Date.now()}`,
        position,
        data: nodeData,
        type: type === 'default' ? undefined : type,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    []
  );

  /** 更新节点数据 */
  const onUpdateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      )
    );
    // 更新选中节点
    setSelectedNode((prev) =>
      prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
    );
  }, []);

  /** 删除节点 */
  const onDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    // 同时删除关联的边
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    setSelectedNode(null);
  }, []);

  /** 删除边 */
  const onDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdge(null);
  }, []);

  /** 关闭属性面板 */
  const onClosePanel = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypesMap}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />

        {/* 节点类型面板 */}
        <Panel position="top-left" className="bg-[#0a1020]/90 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl">
          <div className="text-xs text-slate-400 mb-2 font-medium">拖拽添加节点</div>
          <div className="flex flex-col gap-2">
            {nodeTypes.map((type) => (
              <div
                key={type}
                draggable
                data-type={type}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', type);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-grab active:cursor-grabbing transition-colors text-sm text-slate-300"
              >
                {type === 'input' && '📥 '}
                {type === 'default' && '⚙️ '}
                {type === 'output' && '📤 '}
                {type === 'target' && '🎯 '}
                {type === 'mcp' && '🤖 '}
                {type === 'input' ? 'Input' : type === 'output' ? 'Output' : type === 'target' ? 'Target' : type === 'mcp' ? 'MCP' : 'Default'} 节点
              </div>
            ))}
          </div>
        </Panel>

        {/* 属性面板 - 右侧 */}
        <Panel position="top-right" className="mt-4 mr-4">
          <PropertiesPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onUpdateNode={onUpdateNode}
            onDeleteNode={onDeleteNode}
            onDeleteEdge={onDeleteEdge}
            onClose={onClosePanel}
          />
        </Panel>

        {/* 提示信息 */}
        <Panel position="bottom-right" className="bg-[#0a1020]/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 shadow-xl">
          <div className="text-xs text-slate-500">
            <span className="text-slate-400">提示：</span>
            点击节点编辑 · 拖拽画布平移 · 滚轮缩放
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
