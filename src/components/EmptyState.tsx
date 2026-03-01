// ═══════════════════════════════════════════════════════════
// §50/§71 Empty State Template — 统一空态组件
// ═══════════════════════════════════════════════════════════

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon = "📭", title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
      <span className="text-4xl mb-4" aria-hidden="true">{icon}</span>
      <h3 className="text-lg font-medium text-slate-200 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-md mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
