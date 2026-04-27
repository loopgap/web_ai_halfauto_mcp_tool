/**
 * McpTauriAdapter
 * Tauri transport adapter using invoke commands
 */

import type { McpAdapter, McpServerInfo } from "./McpAdapter";

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