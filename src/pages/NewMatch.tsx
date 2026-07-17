import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Profile, LeagueConfigRow } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Avatar } from '@/components/ui/Avatar'
import { computeEloChange, DEFAULT_CONFIG, LeagueConfig } from '@/lib/elo'
import { Empty } from './Leaderboard'

export function NewMatch() {
  const { profile: me } = useAuth()
  const { showToast } = useToast()
  const [players, setPlayers] = useState<Profile[]>([])
  const [config, setConfig] = useState<LeagueConfig>(DEFAULT_CONFIG)
  const [opponentId, setOpponentId] = useState('')
  const [myScore, setMyScore] = useState('')
  const [oppScore, setOppScore] = useState('')
  const [myTeamRating, setMyTeamRating] = useState('')
  const [oppTeamRating, setOppTeamRating] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('profiles').select('*').eq('is_active', true).then(({ data }) => {
      setPlayers((data ?? []).filter((p) => p.id !== me?.id))
    })
    supabase.from('league_config').select('*').eq('id', true).single().then(({ data }) => {
      if (data) setConfig(data as LeagueConfigRow)
    })
  }, [me])

  const opponent = players.find((p) => p.id === opponentId) ?? null

  const preview = useMemo(() => {
    if (!me || !opponent || myScore === '' || oppScore === '') return null
    return computeEloChange(
      {
        myElo: me.elo_rating,
        opponentElo: opponent.elo_rating,
        myGamesPlayed: me.matches_played,
        myTeamRating: myTeamRating === '' ? null : Number(myTeamRating),
        opponentTeamRating: oppTeamRating === '' ? null : Number(oppTeamRating),
        myGoals: Number(myScore),
        opponentGoals: Number(oppScore),
      },
      config
    )
  }, [me, opponent, myScore, oppScore, myTeamRating, oppTeamRating, config])

  if (players.length === 0) {
    return <Empty text="Il faut au moins un autre joueur inscrit pour enregistrer un match." />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!opponentId) { setError('Choisis un adversaire.'); return }
    if (myScore === '' || oppScore === '') { setError('Renseigne les deux scores.'); return }
    for (const [label, v] of [['Ta note d\'équipe', myTeamRating], ["La note d'équipe adverse", oppTeamRating]] as const) {
      if (v !== '' && (Number(v) < 1 || Number(v) > 99)) { setError(`${label} doit être entre 1 et 99.`); return }
    }

    setLoading(true)
    const { error } = await supabase.from('matches').insert({
      player1_id: me!.id,
      player2_id: opponentId,
      player1_score: Number(myScore),
      player2_score: Number(oppScore),
      team1_rating: myTeamRating === '' ? null : Number(myTeamRating),
      team2_rating: oppTeamRating === '' ? null : Number(oppTeamRating),
      created_by: me!.id,
      status: 'pending',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    showToast('Match envoyé — en attente de confirmation.', 'success')
    navigate('/history')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gradient-to-br from-pitch-panel to-pitch-raised border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-turf-bright">
          <Swords size={18} />
          <h2 className="font-display text-2xl tracking-wide">Nouveau match</h2>
        </div>
        <p className="text-ink-dim text-xs mt-1">
          Ton adversaire devra confirmer le résultat avant que l'ELO ne change.
        </p>
      </div>

      <div className="bg-pitch-panel border border-white/10 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-ink-dim mb-1.5">Adversaire</label>
          <select
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
            className="w-full bg-pitch-raised border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-turf transition-colors"
          >
            <option value="">— Choisir —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.username} ({p.elo_rating})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wide text-ink-dim">Tes buts</label>
            <input type="number" min="0" value={myScore} onChange={(e) => setMyScore(e.target.value)}
              className="w-full bg-pitch-raised border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-turf text-center font-mono text-lg" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wide text-ink-dim">Ses buts</label>
            <input type="number" min="0" value={oppScore} onChange={(e) => setOppScore(e.target.value)}
              className="w-full bg-pitch-raised border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-turf text-center font-mono text-lg" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wide text-ink-dim mb-1.5">
            Note d'équipe (optionnel, améliore la précision de l'ELO)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="1" max="99" placeholder="Ex: 85" value={myTeamRating}
              onChange={(e) => setMyTeamRating(e.target.value)}
              className="w-full bg-pitch-raised border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-turf text-center font-mono" />
            <input type="number" min="1" max="99" placeholder="Ex: 90" value={oppTeamRating}
              onChange={(e) => setOppTeamRating(e.target.value)}
              className="w-full bg-pitch-raised border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-turf text-center font-mono" />
          </div>
        </div>

        {error && <div className="text-crimson text-xs bg-crimson/10 border border-crimson/30 rounded-lg p-2">{error}</div>}
      </div>

      {preview && opponent && (
        <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4 animate-fade-in">
          <div className="text-[11px] uppercase tracking-wide text-ink-dim mb-3">Aperçu de la variation ELO</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar username={me!.username} avatarUrl={me!.avatar_url} size="sm" elo={me!.elo_rating} />
              <div>
                <div className="text-sm font-semibold">{me!.username}</div>
                <div className={`flex items-center gap-1 font-mono text-sm font-bold ${preview.finalChange >= 0 ? 'text-turf-bright' : 'text-crimson'}`}>
                  {preview.finalChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {preview.finalChange >= 0 ? '+' : ''}{preview.finalChange}
                </div>
              </div>
            </div>
            <div className="text-ink-faint text-xs font-mono">vs {opponent.username}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center text-[10px] text-ink-dim font-mono">
            <div className="bg-pitch-raised rounded-lg py-1.5">K {preview.k}</div>
            <div className="bg-pitch-raised rounded-lg py-1.5">Équipe ×{preview.teamFactor.toFixed(2)}</div>
            <div className="bg-pitch-raised rounded-lg py-1.5">Marge ×{preview.marginFactor.toFixed(2)}</div>
          </div>
        </div>
      )}

      <button disabled={loading} className="w-full bg-turf text-pitch font-bold py-3.5 rounded-xl shadow-glow shadow-turf/30 hover:bg-turf-bright transition-colors disabled:opacity-50">
        {loading ? 'Envoi…' : 'Envoyer pour confirmation'}
      </button>
    </form>
  )
}
