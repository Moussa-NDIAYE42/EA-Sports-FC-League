import { Shield, Award, Star, Gem, Crown, Flame } from 'lucide-react'
import { getRank, RankId } from '@/lib/ranks'

const ICONS: Record<RankId, typeof Shield> = {
  bronze: Shield,
  silver: Award,
  gold: Star,
  elite: Gem,
  champion: Crown,
  legend: Flame,
}

export function RankBadge({ elo, size = 'md' }: { elo: number; size?: 'sm' | 'md' }) {
  const rank = getRank(elo)
  const Icon = ICONS[rank.id]
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
  const iconSize = size === 'sm' ? 10 : 12

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide ${padding} ${rank.colorClass} ${rank.bgClass} ${rank.borderClass}`}
    >
      <Icon size={iconSize} />
      {rank.label}
    </span>
  )
}
