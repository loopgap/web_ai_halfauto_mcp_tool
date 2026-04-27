/**
 * MCP Client 模块
 *
 * 提供与 MCP Server 通信的客户端功能
 * 通过 Web Worker 处理 STDIO 传输
 */

// Worker 消息类型
export interface McpWorkerMessage {
  type: "init" | "request" | "response" | "error" | "notification";
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  data?: unknown;
}

// MCP 客户端选项
export interface McpClientOptions {
  /** Tauri 命令前缀 */
  commandPrefix?: string;
  /** 超时时间 (毫秒) */
  timeout?: number;
}

/**
 * MCP 客户端类
 *
 * 通过 Web Worker 与 MCP Server 通信
 */
export class McpClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;
  private options: Required<McpClientOptions>;

  constructor(options: McpClientOptions = {}) {
    this.options = {
      commandPrefix: options.commandPrefix ?? "mcp",
      timeout: options.timeout ?? 30000,
    };
  }

  /**
   * 初始化 MCP Client
   * 创建 Web Worker 并建立通信
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    // 创建 Web Worker
    this.worker = new Worker(
      new URL("./mcpWorker.ts", import.meta.url),
      { type: "module" }
    );

    // 设置消息处理器
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = this.handleWorkerError.bind(this);

    // 发送初始化消息
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.initPromise = null;
        reject(new Error("MCP Client initialization timeout"));
      }, this.options.timeout);

      this.pendingRequests.set("init", {
        resolve: () => {
          clearTimeout(timeoutId);
          this.isInitialized = true;
          resolve();
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          this.initPromise = null;
          reject(err);
        },
      });

      this.sendMessage({ type: "init" });
    });
  }

  /**
   * 发送 MCP 请求
   */
  async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ): Promise<T> {
    if (!this.isInitialized) {
      throw new Error("MCP Client not initialized");
    }

    // 检查是否已中止
    if (options?.signal?.aborted) {
      throw new Error(`MCP request ${method} aborted`);
    }

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // 设置中止监听器
      const abortHandler = () => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request ${method} aborted`));
      };
      options?.signal?.addEventListener("abort", abortHandler);

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        options?.signal?.removeEventListener("abort", abortHandler);
        reject(new Error(`MCP request ${method} timeout`));
      }, this.options.timeout);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeoutId);
          options?.signal?.removeEventListener("abort", abortHandler);
          resolve(value as T);
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          options?.signal?.removeEventListener("abort", abortHandler);
          reject(err);
        },
      });

      this.sendMessage({
        type: "request",
        id,
        method,
        params,
      });
    });
  }

  /**
   * 列出可用工具
   */
  async listTools(): Promise<{ tools: Array<{ name: string; description: string; inputSchema: object }> }> {
    return this.request("tools/list");
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }> {
    return this.request("tools/call", { name, arguments: args });
  }

  /**
   * 取消所有待处理的请求
   */
  cancelPendingRequests(): void {
    for (const [id, pending] of this.pendingRequests) {
      this.pendingRequests.delete(id);
      pending.reject(new Error("MCP Client closed"));
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * 关闭客户端
   */
  async close(): Promise<void> {
    this.cancelPendingRequests();
  }

  /**
   * 处理来自 Worker 的消息
   */
  private handleWorkerMessage(event: MessageEvent<McpWorkerMessage>): void {
    const message = event.data;

    switch (message.type) {
      case "response":
      case "error":
        if (message.id) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            this.pendingRequests.delete(message.id);
            if (message.type === "error" && message.error) {
              pending.reject(new Error(message.error.message));
            } else {
              pending.resolve(message.result);
            }
          }
        }
        break;

      case "notification":
        // 处理通知消息
        this.handleNotification(message);
        break;

      case "error":
        if (message.id === "init") {
          const pending = this.pendingRequests.get("init");
          if (pending) {
            this.pendingRequests.delete("init");
            pending.reject(new Error(message.error?.message ?? "Unknown error"));
          }
        }
        break;
    }
  }

  /**
   * 处理通知
   */
  private handleNotification(message: McpWorkerMessage): void {
    // 可扩展：处理来自服务器的主动通知
    console.debug("[McpClient] Notification:", message);
  }

  /**
   * 处理 Worker 错误
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error("[McpClient] Worker error:", error);
    // 拒绝所有待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      this.pendingRequests.delete(id);
      pending.reject(new Error(`Worker error: ${error.message}`));
    }
  }

  /**
   * 发送消息到 Worker
   */
  private sendMessage(message: McpWorkerMessage): void {
    if (this.worker) {
      this.worker.postMessage(message);
    }
  }
}

// 导出类型别名
export type McpClientInstance = McpClient;
