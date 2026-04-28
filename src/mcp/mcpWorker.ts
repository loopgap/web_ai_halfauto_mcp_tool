/**
 * MCP Worker
 *
 * Web Worker 处理与 MCP Server 的 STDIO 通信
 * 通过 Tauri 命令与后端 MCP Server 交互
 */

import { invoke } from "@tauri-apps/api/core";
import type { McpWorkerMessage } from "./McpClient";

// Tauri 命令前缀
const TAURI_CMD_PREFIX = "mcp";

// MCP JSON-RPC 消息类型
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * 发送 JSON-RPC 请求到 MCP Server
 */
async function sendJsonRpcRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method,
    params,
  };

  try {
    const response = await invoke<JsonRpcResponse>(`${TAURI_CMD_PREFIX}_request`, {
      request: JSON.stringify(request),
    });

    if (response.error) {
      throw new Error(`MCP Error ${response.error.code}: ${response.error.message}`);
    }

    return response.result;
  } catch (error) {
    console.error("[McpWorker] Request failed, retrying...");
    throw error;
  }
}

/**
 * 列出可用工具
 */
async function listTools(): Promise<{ tools: Array<{ name: string; description: string; inputSchema: object }> }> {
  const result = await sendJsonRpcRequest("tools/list");
  return result as { tools: Array<{ name: string; description: string; inputSchema: object }> };
}

/**
 * 调用工具
 */
async function callTool(name: string, args?: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }> {
  const result = await sendJsonRpcRequest("tools/call", { name, arguments: args });
  return result as { content: Array<{ type: string; text?: string }> };
}

/**
 * 获取服务器信息
 */
async function getServerInfo(): Promise<{ name: string; version: string }> {
  const result = await sendJsonRpcRequest("initialize");
  return result as { name: string; version: string };
}

/**
 * 处理来自主线程的消息
 */
self.onmessage = async (event: MessageEvent<McpWorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "init":
      try {
        // 初始化 MCP 连接
        await invoke(`${TAURI_CMD_PREFIX}_start`);
        const info = await getServerInfo();

        // 发送初始化成功响应
        self.postMessage({
          type: "response",
          id: "init",
          result: { success: true, serverInfo: info },
        });
      } catch (error) {
        self.postMessage({
          type: "error",
          id: "init",
          error: {
            code: -1,
            message: 'Initialization failed',  // Generic message
          },
        });
      }
      break;

    case "request":
      if (message.id && message.method) {
        try {
          let result: unknown;

          switch (message.method) {
            case "tools/list":
              result = await listTools();
              break;

            case "tools/call":
              const { name, arguments: args } = message.params ?? {};
              result = await callTool(name as string, args as Record<string, unknown> | undefined);
              break;

            default:
              // 通用请求处理
              result = await sendJsonRpcRequest(message.method, message.params);
          }

          self.postMessage({
            type: "response",
            id: message.id,
            result,
          });
        } catch (error) {
          self.postMessage({
            type: "error",
            id: message.id,
            error: {
              code: -1,
              message: 'Request failed',  // Generic message
            },
          });
        }
      }
      break;

    default:
      console.warn("[McpWorker] Unknown message type:", message.type);
  }
};

/**
 * 通知主线程 Worker 已就绪
 */
self.postMessage({ type: "notification", method: "ready" });
