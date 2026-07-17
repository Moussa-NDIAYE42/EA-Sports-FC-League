import { useEffect, useState, useCallback } from 'react'
import { Check, X, ChevronDown, History as HistoryIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Match } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { Empty } from './Leaderboard'

export function History() {
  const { profile: me } = useAuth()
  const { showToast } = useToast()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<Match | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('*, player1:player1_id(username, avatar_url, elo_rating), player2:player2_id(username, avatar_url, elo_rating)')
      .order('created_at', { ascending: false })
    setMatches((data as unknown as Match[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function respond(matchId: string, status: 'confirmed' | 'disputed') {
    setBusy(true)
    const { error } = await supabase.from('matches').update({ status }).eq('id', matchId)
    setBusy(false)
    setDisputeTarget(null)
    if (error) { showToast(error.message, 'error'); return }
    showToast(status === 'confirmed' ? 'Match confirmé — ELO mis à jour.' : 'Match contesté.', status === 'confirmed' ? 'success' : 'info')
    load()
  }

  if (loading) return <ListSkeleton />

  const pending = matches.filter((m) => m.status === 'pending' && m.player2_id === me?.id)
  const rest = matches.filter((m) => !(m.status === 'pending' && m.player2_id === me?.id))

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="bg-gold/10 border border-gold/30 rounded-2xl p-4 animate-fade-in">
          <h2 className="font-display text-lg tracking-wide text-gold mb-2">À confirmer</h2>
          <div className="space-y-2">
            {pending.map((m) => (
              <div key={m.id} className="bg-pitch-raised rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Avatar username={m.player1?.username ?? '?'} avatarUrl={m.player1?.avatar_url ?? null} size="xs" />
                  <span className="truncate"><span className="font-semibold">{m.player1?.username}</span> déclare{' '}
                  <span className="font-mono font-bold">{m.player1_score}–{m.player2_score}</span></span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => respond(m.id, 'confirmed')} className="p-2 rounded-lg bg-turf/20 text-turf hover:bg-turf/30 transition-colors">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setDisputeTarget(m)} className="p-2 rounded-lg bg-crimson/20 text-crimson hover:bg-crimson/30 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <HistoryIcon size={18} className="text-turf" />
          <h2 className="font-display text-xl tracking-wide">Historique</h2>
        </div>
        {rest.length === 0 ? (
          <Empty text="Aucun match dans l'historique." />
        ) : (
          <div className="space-y-2">
            {rest.map((m) => {
              const detail = m.calculation_detail
              const isExpanded = expanded === m.id
              return (
                <div key={m.id} className="border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : m.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex justify-between text-[11px] font-mono text-ink-faint mb-1.5">
                      <span>{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={m.status} />
                        {detail && <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                        <span className="text-sm font-semibold truncate">{m.player1?.username}</span>
                        <Avatar username={m.player1?.username ?? '?'} avatarUrl={m.player1?.avatar_url ?? null} size="xs" />
                      </div>
                      <span className="font-mono font-bold text-base shrink-0">{m.player1_score} – {m.player2_score}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <Avatar username={m.player2?.username ?? '?'} avatarUrl={m.player2?.avatar_url ?? null} size="xs" />
                        <span className="text-sm font-semibold truncate">{m.player2?.username}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && detail && (
                    <div className="bg-pitch-raised/60 border-t border-white/10 p-3 grid grid-cols-2 gap-3 text-xs animate-fade-in">
                      <CalcBreakdown label={m.player1?.username ?? 'Joueur 1'} detail={detail.player1} />
                      <CalcBreakdown label={m.player2?.username ?? 'Joueur 2'} detail={detail.player2} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!disputeTarget}
        title="Contester ce match ?"
        description="Le score ne correspond pas ? Le match sera marqué comme contesté et un admin devra trancher. L'ELO ne changera pas."
        confirmLabel="Contester"
        danger
        loading={busy}
        onConfirm={() => disputeTarget && respond(disputeTarget.id, 'disputed')}
        onCancel={() => setDisputeTarget(null)}
      />
    </div>
  )
}

function CalcBreakdown({ label, detail }: { label: string; detail: NonNullable<Match['calculation_detail']>['player1'] }) {
  return (
    <div>
      <div className="font-semibold text-ink mb-1 truncate">{label}</div>
      <div className="space-y-0.5 font-mono text-[11px] text-ink-dim">
        <div className="flex justify-between"><span>ELO</span><span>{detail.elo_before} → {detail.elo_after}</span></div>
        <div className="flex justify-between"><span>Variation</span>
          <span className={detail.final_change >= 0 ? 'text-turf-bright' : 'text-crimson'}>
            {detail.final_change >= 0 ? '+' : ''}{detail.final_change}
          </span>
        </div>
        <div className="flex justify-between"><span>Facteur équipe</span><span>×{detail.team_factor}</span></div>
        <div className="flex justify-between"><span>Facteur marge</span><span>×{detail.margin_factor}</span></div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Match['status'] }) {
  const map: Record<Match['status'], { label: string; cls: string }> = {
    pending: { label: 'En attente', cls: 'text-gold' },
    confirmed: { label: 'Confirmé', cls: 'text-turf' },
    disputed: { label: 'Contesté', cls: 'text-crimson' },
    cancelled: { label: 'Annulé', cls: 'text-ink-faint' },
  }
  const s = map[status]
  return <span className={s.cls}>{s.label}</span>
}
