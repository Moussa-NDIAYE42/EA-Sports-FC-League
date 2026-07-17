import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Profile, InviteCode, Match, LeagueConfigRow } from '@/types'
import { Copy, UserX, UserCheck, Trash2, Settings2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ListSkeleton } from '@/components/ui/Skeleton'

export function Admin() {
  const [tab, setTab] = useState<'players' | 'invites' | 'matches' | 'config'>('players')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-pitch-panel border border-white/10 rounded-xl p-1 overflow-x-auto">
        {(['players', 'invites', 'matches', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold whitespace-nowrap px-2 transition-colors ${tab === t ? 'bg-turf text-pitch' : 'text-ink-dim'}`}
          >
            {t === 'players' ? 'Joueurs' : t === 'invites' ? 'Invitations' : t === 'matches' ? 'Matchs' : 'Formule ELO'}
          </button>
        ))}
      </div>
      {tab === 'players' && <AdminPlayers />}
      {tab === 'invites' && <AdminInvites />}
      {tab === 'matches' && <AdminMatches />}
      {tab === 'config' && <AdminConfig />}
    </div>
  )
}

// ---------------- Joueurs ----------------
function AdminPlayers() {
  const { showToast } = useToast()
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('elo_rating', { ascending: false })
    setPlayers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(p: Profile) {
    const { error } = await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) { showToast(error.message, 'error'); return }
    showToast(p.is_active ? `${p.username} désactivé.` : `${p.username} réactivé.`, 'success')
    load()
  }

  async function adjustElo(p: Profile) {
    const input = prompt(`Nouvel ELO pour ${p.username} (actuel : ${p.elo_rating})`, String(p.elo_rating))
    if (input === null) return
    const value = Number(input)
    if (!Number.isFinite(value)) { showToast('Valeur invalide.', 'error'); return }
    const { error } = await supabase.from('profiles').update({ elo_rating: value, highest_elo: Math.max(value, p.highest_elo) }).eq('id', p.id)
    if (error) { showToast(error.message, 'error'); return }
    showToast(`ELO de ${p.username} ajusté à ${value}.`, 'success')
    load()
  }

  if (loading) return <ListSkeleton />

  return (
    <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="font-display text-lg tracking-wide">Joueurs</h2>
        <span className="font-mono text-xs text-ink-dim">{players.length}/20</span>
      </div>
      <div className="space-y-2">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2 bg-pitch-raised rounded-xl p-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{p.username} {!p.is_active && <span className="text-crimson text-xs">(désactivé)</span>}</div>
              <div className="text-ink-dim text-xs font-mono">{p.elo_rating} ELO · {p.role}</div>
            </div>
            <button onClick={() => adjustElo(p)} className="text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 shrink-0 transition-colors">
              Ajuster ELO
            </button>
            <button onClick={() => toggleActive(p)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 shrink-0 transition-colors" title={p.is_active ? 'Désactiver' : 'Réactiver'}>
              {p.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
            </button>
          </div>
        ))}
      </div>
      <p className="text-ink-faint text-[11px] mt-3">
        Désactiver retire un joueur du classement sans supprimer son historique. La suppression complète d'un compte se fait depuis le dashboard Supabase (Auth) pour des raisons de sécurité.
      </p>
    </div>
  )
}

// ---------------- Invitations ----------------
function AdminInvites() {
  const { showToast } = useToast()
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('invite_codes').select('*').order('created_at', { ascending: false })
    setInvites(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createInvite() {
    const code = generateCode()
    const { error } = await supabase.from('invite_codes').insert({ code })
    if (error) { showToast(error.message, 'error'); return }
    showToast('Code généré.', 'success')
    load()
  }

  if (loading) return <ListSkeleton />

  return (
    <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-display text-lg tracking-wide">Codes d'invitation</h2>
        <button onClick={createInvite} className="text-xs font-semibold bg-turf text-pitch px-3 py-1.5 rounded-lg hover:bg-turf-bright transition-colors">
          Générer un code
        </button>
      </div>
      <div className="space-y-2">
        {invites.map((inv) => (
          <div key={inv.id} className="flex items-center gap-2 bg-pitch-raised rounded-xl p-2.5">
            <code className="font-mono text-sm flex-1">{inv.code}</code>
            <span className={`text-[11px] ${inv.used_by ? 'text-ink-faint' : 'text-turf'}`}>
              {inv.used_by ? 'Utilisé' : 'Disponible'}
            </span>
            {!inv.used_by && (
              <button onClick={() => { navigator.clipboard.writeText(inv.code); showToast('Code copié.', 'success') }} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <Copy size={13} />
              </button>
            )}
          </div>
        ))}
        {invites.length === 0 && <p className="text-ink-dim text-sm">Aucun code généré pour l'instant.</p>}
      </div>
    </div>
  )
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code.match(/.{1,4}/g)!.join('-')
}

// ---------------- Matchs ----------------
function AdminMatches() {
  const { showToast } = useToast()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<Match | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('*, player1:player1_id(username), player2:player2_id(username)')
      .order('created_at', { ascending: false })
      .limit(50)
    setMatches((data as unknown as Match[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function cancelMatch() {
    if (!target) return
    setBusy(true)
    const { error } = await supabase.from('matches').update({ status: 'cancelled' }).eq('id', target.id)
    setBusy(false)
    setTarget(null)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Match annulé.', 'success')
    load()
  }

  if (loading) return <ListSkeleton />

  return (
    <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
      <h2 className="font-display text-lg tracking-wide mb-3">Tous les matchs</h2>
      <p className="text-ink-faint text-[11px] mb-3">
        Annuler un match déjà confirmé ne recalcule pas automatiquement l'ELO qui en a découlé — utilise "Ajuster ELO" sur les joueurs concernés si besoin.
      </p>
      <div className="space-y-2">
        {matches.map((m) => (
          <div key={m.id} className="flex items-center gap-2 bg-pitch-raised rounded-xl p-2.5">
            <div className="flex-1 min-w-0 text-sm">
              <span className="truncate">{m.player1?.username} {m.player1_score}–{m.player2_score} {m.player2?.username}</span>
              <div className="text-ink-faint text-[11px]">{m.status}</div>
            </div>
            {m.status !== 'cancelled' && (
              <button onClick={() => setTarget(m)} className="p-2 rounded-lg bg-crimson/10 text-crimson hover:bg-crimson/20 shrink-0 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!target}
        title="Annuler ce match ?"
        description={target ? `${target.player1?.username} ${target.player1_score}–${target.player2_score} ${target.player2?.username}. L'ELO déjà appliqué ne sera pas recalculé automatiquement.` : ''}
        confirmLabel="Annuler le match"
        danger
        loading={busy}
        onConfirm={cancelMatch}
        onCancel={() => setTarget(null)}
      />
    </div>
  )
}

// ---------------- Formule ELO ----------------
const FIELDS: { key: keyof LeagueConfigRow; label: string; step?: string }[] = [
  { key: 'k_provisional', label: 'K-Factor (joueur en calibrage)' },
  { key: 'k_established', label: 'K-Factor (joueur établi)' },
  { key: 'provisional_threshold', label: 'Matchs avant calibrage terminé' },
  { key: 'weight_team', label: 'Poids niveau équipe', step: '0.05' },
  { key: 'weight_margin', label: 'Poids marge de victoire', step: '0.05' },
  { key: 'margin_cap', label: 'Plafond marge de buts (buts)' },
  { key: 'max_change', label: 'Variation ELO maximale' },
  { key: 'min_change', label: 'Variation ELO minimale' },
]

function AdminConfig() {
  const { showToast } = useToast()
  const [config, setConfig] = useState<LeagueConfigRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('league_config').select('*').eq('id', true).single().then(({ data }) => {
      setConfig(data)
      setLoading(false)
    })
  }, [])

  async function save() {
    if (!config) return
    setSaving(true)
    const { error } = await supabase
      .from('league_config')
      .update({
        k_provisional: config.k_provisional,
        k_established: config.k_established,
        provisional_threshold: config.provisional_threshold,
        weight_team: config.weight_team,
        weight_margin: config.weight_margin,
        margin_cap: config.margin_cap,
        max_change: config.max_change,
        min_change: config.min_change,
      })
      .eq('id', true)
    setSaving(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Formule ELO mise à jour — s\'applique aux prochains matchs.', 'success')
  }

  if (loading || !config) return <ListSkeleton />

  return (
    <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Settings2 size={16} className="text-turf" />
        <h2 className="font-display text-lg tracking-wide">Système ELO Performance</h2>
      </div>
      <p className="text-ink-faint text-[11px] mb-4">
        Ajuste les facteurs qui pondèrent le calcul ELO. Voir docs/ELO_SYSTEM.md pour le détail de la formule. Les changements ne s'appliquent qu'aux matchs confirmés après la sauvegarde.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, step }) => (
          <div key={key}>
            <label className="block text-[10px] uppercase tracking-wide text-ink-dim mb-1">{label}</label>
            <input
              type="number"
              step={step ?? '1'}
              value={config[key] as number}
              onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
              className="w-full bg-pitch-raised border border-white/15 rounded-lg px-2.5 py-2 text-sm font-mono outline-none focus:border-turf"
            />
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-4 bg-turf text-pitch font-bold py-2.5 rounded-lg hover:bg-turf-bright transition-colors disabled:opacity-50"
      >
        {saving ? 'Sauvegarde…' : 'Sauvegarder'}
      </button>
    </div>
  )
}
