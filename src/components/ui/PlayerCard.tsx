import { Link } from 'react-router-dom'
import { Profile } from '@/types'
import { Avatar } from './Avatar'
import { RankBadge } from './RankBadge'
import { FormPills } from './FormPills'
import { getRank, rankProgress } from '@/lib/ranks'

/** Carte compacte — utilisée dans les listes de classement / historique. */
export function PlayerCardRow({
  player,
  position,
  highlight = false,
}: {
  player: Profile
  position?: number
  highlight?: boolean
}) {
  const rank = getRank(player.elo_rating)

  return (
    <Link
      to={`/profile/${player.id}`}
      className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all hover:scale-[1.01] ${rank.cardBgClass} ${
        highlight ? 'border-turf shadow-glow shadow-turf/20' : `${rank.borderClass}`
      }`}
    >
      {position !== undefined && (
        <div className="w-6 text-center font-display text-lg text-ink-dim shrink-0">{position}</div>
      )}
      <Avatar username={player.username} avatarUrl={player.avatar_url} size="sm" elo={player.elo_rating} ring />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{player.username}</span>
          <RankBadge elo={player.elo_rating} size="sm" />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <FormPills form={player.recent_form.slice(-5)} size="xs" />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono font-bold text-sm">{player.elo_rating}</div>
        <div className={`font-mono text-[11px] ${player.goal_difference >= 0 ? 'text-turf-bright' : 'text-crimson'}`}>
          {player.goal_difference >= 0 ? '+' : ''}{player.goal_difference} diff.
        </div>
      </div>
    </Link>
  )
}

/** Grande carte façon "carte de joueur" — profil, podium, cartes premium. */
export function PlayerCardLarge({ player }: { player: Profile }) {
  const rank = getRank(player.elo_rating)
  const { next, progress } = rankProgress(player.elo_rating)

  return (
    <div className={`relative overflow-hidden rounded-3xl border p-6 ${rank.cardBgClass} ${rank.borderClass}`}>
      {/* motif terrain en filigrane */}
      <div className="absolute inset-0 bg-pitch-lines bg-[length:24px_24px] opacity-40 pointer-events-none" />
      <div className="relative flex flex-col items-center text-center">
        <Avatar username={player.username} avatarUrl={player.avatar_url} size="xl" elo={player.elo_rating} ring />
        <h2 className="font-display text-3xl tracking-wide mt-3">{player.username}</h2>
        <RankBadge elo={player.elo_rating} />
        <div className="font-mono text-4xl font-bold mt-3">{player.elo_rating}</div>
        <div className="text-ink-faint text-[11px] uppercase tracking-widest">Score ELO</div>

        {next && (
          <div className="w-full max-w-[220px] mt-4">
            <div className="flex justify-between text-[10px] text-ink-faint mb-1">
              <span>{rank.label}</span>
              <span>{next.label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-turf to-turf-bright transition-all`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 w-full mt-5">
          <Stat label="MJ" value={player.matches_played} />
          <Stat label="V-N-D" value={`${player.wins}-${player.draws}-${player.losses}`} />
          <Stat label="Buts" value={`${player.goals_for}:${player.goals_against}`} />
          <Stat label="Diff." value={player.goal_difference >= 0 ? `+${player.goal_difference}` : player.goal_difference} accent={player.goal_difference >= 0} />
        </div>

        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">Forme récente</span>
          <FormPills form={player.recent_form.slice(-5)} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-black/20 rounded-xl py-2 border border-white/5">
      <div className={`font-mono font-bold text-sm ${accent === undefined ? 'text-ink' : accent ? 'text-turf-bright' : 'text-crimson'}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-ink-faint mt-0.5">{label}</div>
    </div>
  )
}
