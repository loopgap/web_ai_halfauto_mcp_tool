/**
 * MCP Transport Adapter Interface
 * Unified abstraction for both Tauri invoke and HTTP transport
 */

export interface McpServerInfo {
  name: string;
  version: string;
  transport: "tauri" | "http";
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface McpCallResult {
  content: Array<{ type: string; text?: string }>;
}

export interface McpAdapter {
  /** Get transport type */
  getTransportType(): "tauri" | "http";

  /** Initialize connection */
  connect(): Promise<McpServerInfo>;

  /** Send JSON-RPC request */
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;

  /** List available tools */
  listTools(): Promise<{ tools: ToolDefinition[] }>;

  /** Call a tool */
  callTool(name: string, args?: Record<string, unknown>): Promise<McpCallResult>;

  /** Close connection */
  close(): Promise<void>;

  /** Connection status */
  isConnected(): boolean;
}

/**
 * Unified error type for MCP operations
 */
export class McpError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly transport: "tauri" | "http",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "McpError";
  }
}