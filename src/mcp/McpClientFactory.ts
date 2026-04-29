/**
 * MCP Client Factory
 * Creates appropriate adapter based on configuration
 */

import type { McpAdapter, McpServerInfo } from "./adapters/McpAdapter";
import { McpTauriAdapter } from "./adapters/McpTauriAdapter";
import { McpHttpAdapter } from "./adapters/McpHttpAdapter";
import { getMcpConfig, type McpMode } from "./config";

export interface UnifiedMcpClient {
  /** Current transport type */
  transport: McpMode;

  /** Initialize connection */
  connect(): Promise<McpServerInfo>;

  /** Send request */
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;

  /** List tools */
  listTools(): Promise<{ tools: Array<{ name: string; description: string; inputSchema: object }> }>;

  /** Call tool */
  callTool(name: string, args?: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }>;

  /** Close connection */
  close(): Promise<void>;

  /** Connection status */
  isConnected(): boolean;
}

/**
 * Create unified MCP client based on configuration
 */
export function createMcpClient(mode?: McpMode): UnifiedMcpClient {
  const config = getMcpConfig();
  const actualMode = mode ?? config.mode;

  let adapter: McpAdapter;

  if (actualMode === "standalone" && config.standalone) {
    adapter = new McpHttpAdapter({
      baseUrl: config.standalone.baseUrl,
      apiKey: config.standalone.apiKey,
      timeout: config.standalone.timeout,
    });
  } else {
    adapter = new McpTauriAdapter();
  }

  return {
    transport: actualMode,

    async connect() {
      return adapter.connect();
    },

    async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      return adapter.request(method, params) as Promise<T>;
    },

    async listTools() {
      return adapter.listTools();
    },

    async callTool(name: string, args?: Record<string, unknown>) {
      return adapter.callTool(name, args);
    },

    async close() {
      await adapter.close();
    },

    isConnected() {
      return adapter.isConnected();
    },
  };
}