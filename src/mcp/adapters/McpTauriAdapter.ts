/**
 * McpTauriAdapter
 * Tauri transport adapter using invoke commands
 */

import type { McpAdapter, McpServerInfo } from "./McpAdapter";

/// Allowed MCP methods whitelist
const ALLOWED_METHODS = new Set([
  'mcp_start',
  'mcp_request',
  'mcp_stop',
  'tools/list',
  'tools/call',
  'initialize',
  'ping',
]);

/// Tool name format validation (ASCII identifiers only)
const TOOL_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/**
 * Tauri adapter implementation
 */
export class McpTauriAdapter implements McpAdapter {
  private connected = false;

  getTransportType(): "tauri" | "http" {
    return "tauri";
  }

  async connect(): Promise<McpServerInfo> {
    // Tauri connection is implicit via invoke
    this.connected = true;
    return {
      name: "MCP Tauri Server",
      version: "1.0.0",
      transport: "tauri",
    };
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    // 1. Method whitelist check
    if (!ALLOWED_METHODS.has(method)) {
      throw new Error(`Method '${method}' is not allowed`);
    }

    // 2. For tools/call, validate tool name
    if (method === 'tools/call' && params) {
      const toolName = params.name as string;
      if (typeof toolName !== 'string') {
        throw new Error('Tool name must be a string');
      }

      // Validate tool name format
      if (!TOOL_NAME_REGEX.test(toolName)) {
        throw new Error('Invalid tool name format');
      }
    }

    // Use Tauri invoke command
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke(method, params);
  }

  async listTools(): Promise<{ tools: Array<{ name: string; description: string; inputSchema: object }> }> {
    return this.request("tools/list") as Promise<{ tools: Array<{ name: string; description: string; inputSchema: object }> }>;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }> {
    return this.request("tools/call", { name, arguments: args }) as Promise<{ content: Array<{ type: string; text?: string }> }>;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}