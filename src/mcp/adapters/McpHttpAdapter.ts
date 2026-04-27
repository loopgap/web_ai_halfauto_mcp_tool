/**
 * McpHttpAdapter
 * HTTP transport adapter for standalone mode
 */

import type { McpAdapter, McpServerInfo } from "./McpAdapter";

export interface HttpAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * HTTP adapter implementation
 */
export class McpHttpAdapter implements McpAdapter {
  private connected = false;
  private config: HttpAdapterConfig;

  constructor(config: HttpAdapterConfig) {
    this.config = config;
  }

  getTransportType(): "tauri" | "http" {
    return "http";
  }

  async connect(): Promise<McpServerInfo> {
    // Verify connection by calling server info endpoint
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: "GET",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (response.ok) {
        this.connected = true;
        return {
          name: "MCP HTTP Server",
          version: "1.0.0",
          transport: "http",
        };
      }

      throw new Error(`HTTP connection failed: ${response.status}`);
    } catch (error) {
      throw new Error(`Failed to connect to HTTP server: ${error}`);
    }
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.config.baseUrl}/mcp`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method,
        params,
      }),
      signal: AbortSignal.timeout(this.config.timeout ?? 30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
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

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }
}