// ═══════════════════════════════════════════════════════════
// MCP Slice — Zustand Store for MCP Connection State
// §3 前端闭环: Store 全局状态与 reducer (Slices Pattern)
// ═══════════════════════════════════════════════════════════

import { createMcpClient, type UnifiedMcpClient } from "../../mcp/McpClientFactory";
import { McpServerInfo, ToolDefinition, McpError, McpCallResult } from "../../mcp/adapters/McpAdapter";
import type { StandaloneConfig } from "../../mcp/config";

// ───────── State ─────────

export interface McpState {
  mode: "tauri" | "standalone";
  serverInfo: McpServerInfo | null;
  isConnected: boolean;
  isConnecting: boolean;
  tools: ToolDefinition[];
  lastError: McpError | null;
}

// ───────── Full Slice Type (State + Actions) ─────────

export interface McpSlice extends McpState {
  setMode: (mode: "tauri" | "standalone") => void;
  connect: (config?: StandaloneConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<McpCallResult>;
  clearError: () => void;
}

const initialMcpState: McpState = {
  mode: "tauri",
  serverInfo: null,
  isConnected: false,
  isConnecting: false,
  tools: [],
  lastError: null,
};

// ───────── Slice Factory ─────────

type McpSliceSet = (partial: Partial<McpSlice> | ((state: McpSlice) => Partial<McpSlice>)) => void;
type McpSliceGet = () => McpSlice;

let _client: UnifiedMcpClient | null = null;

function getClient(): UnifiedMcpClient {
  if (!_client) {
    _client = createMcpClient();
  }
  return _client;
}

export function createMcpSlice(set: McpSliceSet, get: McpSliceGet): McpSlice {
  return {
    ...initialMcpState,

    // ─── Mode ───
    setMode: (mode: "tauri" | "standalone") => {
      // Close existing connection when changing mode
      const client = _client;
      if (client && client.isConnected()) {
        client.close().catch(() => {/* ignore */});
      }
      _client = null;
      set({
        mode,
        isConnected: false,
        serverInfo: null,
        tools: [],
        lastError: null,
      });
    },

    // ─── Connect ───
    // Note: config parameter reserved for future standalone adapter configuration
    connect: async (_config?: StandaloneConfig) => {
      const state = get();
      if (state.isConnecting || state.isConnected) {
        return;
      }

      set({ isConnecting: true, lastError: null });

      try {
        const client = getClient();
        const serverInfo = await client.connect();

        // Get tools after connection
        const toolsResult = await client.listTools();

        set({
          serverInfo,
          tools: toolsResult.tools,
          isConnected: true,
          isConnecting: false,
        });
      } catch (err) {
        const transport = state.mode === "tauri" ? "tauri" : "http";
        const error = err instanceof Error
          ? new McpError(
              err.message,
              (err as { code?: number }).code ?? -1,
              transport,
              err
            )
          : new McpError(
              "Unknown error during MCP connection",
              -1,
              transport,
              err
            );

        set({
          lastError: error,
          isConnected: false,
          isConnecting: false,
          serverInfo: null,
          tools: [],
        });
      }
    },

    // ─── Disconnect ───
    disconnect: async () => {
      const state = get();
      if (!state.isConnected && !_client) {
        return;
      }

      try {
        const client = getClient();
        await client.close();
      } catch {
        // Ignore close errors
      } finally {
        _client = null;
        set({
          isConnected: false,
          serverInfo: null,
          tools: [],
          lastError: null,
        });
      }
    },

    // ─── Call Tool ───
    callTool: async (name: string, args?: Record<string, unknown>): Promise<McpCallResult> => {
      const state = get();
      const transport = state.mode === "tauri" ? "tauri" : "http";
      if (!state.isConnected) {
        throw new McpError("Not connected to MCP server", -1, transport);
      }

      try {
        const client = getClient();
        return await client.callTool(name, args);
      } catch (err) {
        const error = err instanceof Error
          ? new McpError(
              err.message,
              (err as { code?: number }).code ?? -1,
              transport,
              err
            )
          : new McpError(
              "Unknown error calling MCP tool",
              -1,
              transport,
              err
            );

        set({ lastError: error });
        throw error;
      }
    },

    // ─── Clear Error ───
    clearError: () => {
      set({ lastError: null });
    },
  };
}

// ───────── Selectors ─────────

export const selectMcpMode = (state: McpState): "tauri" | "standalone" => state.mode;
export const selectMcpServerInfo = (state: McpState): McpServerInfo | null => state.serverInfo;
export const selectMcpIsConnected = (state: McpState): boolean => state.isConnected;
export const selectMcpIsConnecting = (state: McpState): boolean => state.isConnecting;
export const selectMcpTools = (state: McpState): ToolDefinition[] => state.tools;
export const selectMcpLastError = (state: McpState): McpError | null => state.lastError;