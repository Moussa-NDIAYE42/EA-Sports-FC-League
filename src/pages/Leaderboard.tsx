import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ArrowUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { RankBadge } from '@/components/ui/RankBadge'
import { PlayerCardRow } from '@/components/ui/PlayerCard'
import { LeaderboardSkeleton } from '@/components/ui/Skeleton'
import { getRank } from '@/lib/ranks'

export function Leaderboard() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const { profile: me } = useAuth()

  useEffect(() => {
    // Départage : ELO > différence de buts > victoires > buts marqués
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('elo_rating', { ascending: false })
      .order('goal_difference', { ascending: false })
      .order('wins', { ascending: false })
      .order('goals_for', { ascending: false })
      .then(({ data }) => {
        setPlayers(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <LeaderboardSkeleton />
  if (players.length === 0) return <Empty text="Aucun joueur actif pour l'instant." />

  const [first, second, third, ...rest] = players
  const myIndex = players.findIndex((p) => p.id === me?.id)
  const playerAbove = myIndex > 0 ? players[myIndex - 1] : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-gold" size={20} />
          <h2 className="font-display text-2xl tracking-wide">Classement</h2>
        </div>
        <span className="font-mono text-[11px] text-ink-dim bg-pitch-panel px-2.5 py-1 rounded-full border border-white/10">
          {players.length}/20
        </span>
      </div>

      {/* Podium top 3 */}
      {first && (
        <div className="grid grid-cols-3 gap-2 items-end">
          {second ? <PodiumCard player={second} position={2} isMe={second.id === me?.id} /> : <div />}
          <PodiumCard player={first} position={1} isMe={first.id === me?.id} />
          {third ? <PodiumCard player={third} position={3} isMe={third.id === me?.id} /> : <div />}
        </div>
      )}

      {/* Écart avec le joueur au-dessus, pour se situer immédiatement */}
      {playerAbove && me && myIndex > 2 && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-ink-dim bg-pitch-panel border border-white/10 rounded-xl py-2">
          <ArrowUp size={13} className="text-turf" />
          <span>
            <strong className="text-ink">{playerAbove.elo_rating - me.elo_rating}</strong> points pour dépasser{' '}
            <strong className="text-ink">{playerAbove.username}</strong>
          </span>
        </div>
      )}

      {/* Reste du classement */}
      {rest.length > 0 && (
        <div className="space-y-1.5">
          {rest.map((p, i) => (
            <PlayerCardRow key={p.id} player={p} position={i + 4} highlight={p.id === me?.id} />
          ))}
        </div>
      )}
    </div>
  )
}

function PodiumCard({ player, position, isMe }: { player: Profile; position: 1 | 2 | 3; isMe: boolean }) {
  const rank = getRank(player.elo_rating)
  const heights = { 1: 'pt-2 pb-4', 2: 'pt-5 pb-4', 3: 'pt-6 pb-4' }
  const medalColor = { 1: 'text-gold', 2: 'text-silver', 3: 'text-rank-bronze' }
  const avatarSize = position === 1 ? 'lg' : 'md'

  return (
    <Link
      to={`/profile/${player.id}`}
      className={`relative flex flex-col items-center rounded-2xl border px-2 ${heights[position]} ${rank.cardBgClass} ${
        isMe ? 'ring-1 ring-turf shadow-glow shadow-turf/20' : rank.borderClass
      } ${position === 1 ? 'shadow-card' : ''} animate-scale-in`}
    >
      {position === 1 && <Trophy className="absolute -top-3 text-gold drop-shadow" size={22} />}
      <span className={`font-display text-2xl ${medalColor[position]}`}>#{position}</span>
      <Avatar username={player.username} avatarUrl={player.avatar_url} size={avatarSize} elo={player.elo_rating} ring />
      <div className="mt-2 text-xs font-semibold truncate max-w-full">{player.username}</div>
      <div className="font-mono font-bold text-sm mt-0.5">{player.elo_rating}</div>
      <div className="mt-1"><RankBadge elo={player.elo_rating} size="sm" /></div>
    </Link>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="bg-pitch-panel border border-white/10 rounded-2xl p-8 text-center text-ink-dim text-sm">
      {text}
    </div>
  )
}
