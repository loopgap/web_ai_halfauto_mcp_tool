// ═══════════════════════════════════════════════════════════
// Error Boundary — route.md §50 显示异常防护
// 组件级崩溃不拖垮整页
// ═══════════════════════════════════════════════════════════

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // §3 错误日志自动脱敏
    const safeMessage = error.message
      .replace(/(?:password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "[REDACTED]")
      .replace(/[A-Za-z0-9+/]{32,}/g, "[REDACTED_BASE64]");
    console.error("[ErrorBoundary]", safeMessage, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center p-8 inner-panel rounded-xl border border-red-500/20 m-4">
          <AlertTriangle size={48} className="text-red-400 mb-4" />
          <h3 className="text-lg font-semibold text-red-300 mb-2">
            组件渲染异常
          </h3>
          <p className="text-sm text-slate-400 mb-1">
            {this.props.fallbackMessage ?? "该区域发生了意外错误"}
          </p>
          <p className="text-xs text-slate-600 font-mono mb-4 max-w-md text-center break-all">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <button
            onClick={this.handleReset}
            aria-label="重试加载此组件"
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            <RotateCcw size={14} />
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
