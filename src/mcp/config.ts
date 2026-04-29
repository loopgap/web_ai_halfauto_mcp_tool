/**
 * MCP Configuration
 */

export type McpMode = "tauri" | "standalone";

export interface StandaloneConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface McpConfig {
  mode: McpMode;
  standalone?: StandaloneConfig;
}

const defaultConfig: McpConfig = {
  mode: "tauri",
};

/**
 * Get MCP configuration
 */
export function getMcpConfig(): McpConfig {
  // Can be extended to load from environment or config file
  return defaultConfig;
}