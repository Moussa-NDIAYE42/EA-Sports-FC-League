export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-white/5 ${className}`}
    >
      <div
        className="absolute inset-0 animate-shimmer"
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
          backgroundSize: '400px 100%',
        }}
      />
    </div>
  )
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-44" />
        <Skeleton className="h-32" />
      </div>
      <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-fade-in">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <Skeleton className="h-56" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}
