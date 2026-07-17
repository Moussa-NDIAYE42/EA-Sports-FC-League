import { getRank } from '@/lib/ranks'

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
} as const

export function Avatar({
  username,
  avatarUrl,
  elo,
  size = 'md',
  ring = false,
}: {
  username: string
  avatarUrl: string | null
  elo?: number
  size?: keyof typeof SIZES
  ring?: boolean
}) {
  const initials = username.slice(0, 2).toUpperCase()
  const rank = elo !== undefined ? getRank(elo) : null

  return (
    <div
      className={`relative shrink-0 rounded-full ${SIZES[size]} ${
        ring && rank ? `ring-2 ring-offset-2 ring-offset-pitch-panel ${rank.borderClass.replace('border-', 'ring-')}` : ''
      }`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className={`w-full h-full rounded-full object-cover border border-white/15`}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full flex items-center justify-center font-mono font-bold border border-white/15 bg-pitch-raised ${
            rank ? rank.colorClass : 'text-turf'
          }`}
        >
          {initials}
        </div>
      )}
    </div>
  )
}
