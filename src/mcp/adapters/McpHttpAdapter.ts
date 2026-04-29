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
    // Validate baseUrl for HTTP Splitting protection
    this.validateUrl(this.config.baseUrl);

    const url = `${this.config.baseUrl}/mcp`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',  // CSRF: send cookies only to same origin
        headers: this.getHeaders(),
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        if (response.status >= 500) {
          message = "Server error";
        } else if (response.status >= 400) {
          message = "Request error";
        }
        throw new Error(message);
      }

      const result = await response.json();
      return result.result ?? result;
    } catch (error) {
      // Sanitize error for client
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error');
      }
      throw error;
    }
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
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add CSRF token if available (from cookie or secure storage)
    const csrfToken = this.getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    // API Key via Authorization header (NOT in URL)
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private getCsrfToken(): string | null {
    // Implementation depends on your security architecture
    // For now, return null (requires backend to support optional CSRF)
    return null;
  }

  private validateUrl(baseUrl: string): void {
    // Prevent HTTP splitting
    if (baseUrl.includes('\n') || baseUrl.includes('\r')) {
      throw new Error('Invalid URL');
    }

    // Only allow http/https
    if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://')) {
      throw new Error('URL must use HTTP or HTTPS');
    }
  }
}