import { FormResult } from '@/types'

const STYLE: Record<FormResult, string> = {
  W: 'bg-turf/20 text-turf-bright border-turf/40',
  D: 'bg-gold/15 text-gold border-gold/40',
  L: 'bg-crimson/15 text-crimson border-crimson/40',
}

const LABEL: Record<FormResult, string> = { W: 'V', D: 'N', L: 'D' }

export function FormPills({ form, size = 'sm' }: { form: FormResult[]; size?: 'sm' | 'xs' }) {
  if (form.length === 0) {
    return <span className="text-ink-faint text-[11px]">Aucun match joué</span>
  }
  const dims = size === 'xs' ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'
  return (
    <div className="flex items-center gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={`flex items-center justify-center rounded-md border font-bold ${dims} ${STYLE[r]}`}
          title={r === 'W' ? 'Victoire' : r === 'D' ? 'Nul' : 'Défaite'}
        >
          {LABEL[r]}
        </span>
      ))}
    </div>
  )
}
