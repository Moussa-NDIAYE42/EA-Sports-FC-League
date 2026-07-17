import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-pitch-overlay/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-pitch-panel border border-white/10 rounded-2xl p-5 shadow-card animate-scale-in">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full shrink-0 ${danger ? 'bg-crimson/15 text-crimson' : 'bg-turf/15 text-turf'}`}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="font-display text-lg tracking-wide">{title}</h3>
            <p className="text-ink-dim text-sm mt-1">{description}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-white/5 hover:bg-white/10 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
              danger ? 'bg-crimson text-white hover:bg-crimson/90' : 'bg-turf text-pitch hover:bg-turf-bright'
            }`}
          >
            {loading ? 'Patiente…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
