import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const STYLE: Record<ToastKind, string> = {
  success: 'border-turf/40 text-turf-bright bg-pitch-panel',
  error: 'border-crimson/40 text-crimson bg-pitch-panel',
  info: 'border-white/15 text-ink bg-pitch-panel',
}

let idCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++idCounter
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 shadow-card text-sm animate-toast-in ${STYLE[t.kind]}`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="text-ink-faint hover:text-ink shrink-0">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider')
  return ctx
}
