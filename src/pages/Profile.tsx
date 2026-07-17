import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'
import { Camera, Trash2, Swords } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Profile as ProfileType, EloHistoryEntry, Match } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { PlayerCardLarge } from '@/components/ui/PlayerCard'
import { Avatar } from '@/components/ui/Avatar'
import { ProfileSkeleton } from '@/components/ui/Skeleton'
import { validateAvatarFile, uploadAvatar, removeAvatar } from '@/lib/avatar'

export function Profile() {
  const { id } = useParams()
  const { profile: me, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const targetId = id ?? me?.id
  const isOwn = targetId === me?.id
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [history, setHistory] = useState<EloHistoryEntry[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    if (!targetId) return
    Promise.all([
      supabase.from('profiles').select('*').eq('id', targetId).single(),
      supabase.from('elo_history').select('*').eq('user_id', targetId).order('created_at'),
      supabase
        .from('matches')
        .select('*, player1:player1_id(username, avatar_url), player2:player2_id(username, avatar_url)')
        .eq('status', 'confirmed')
        .or(`player1_id.eq.${targetId},player2_id.eq.${targetId}`)
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([p, h, m]) => {
      setProfile(p.data)
      setHistory(h.data ?? [])
      setMatches((m.data as unknown as Match[]) ?? [])
      setLoading(false)
    })
  }

  useEffect(load, [targetId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !me) return
    const err = validateAvatarFile(file)
    if (err) { showToast(err, 'error'); return }
    setUploading(true)
    try {
      await uploadAvatar(me.id, file)
      await refreshProfile()
      load()
      showToast('Photo de profil mise à jour.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Échec de l'upload.", 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!me) return
    setUploading(true)
    try {
      await removeAvatar(me.id)
      await refreshProfile()
      load()
      showToast('Photo supprimée.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Échec de la suppression.', 'error')
    } finally {
      setUploading(false)
    }
  }

  if (loading || !profile) return <ProfileSkeleton />

  const chartData = history.map((h) => ({ elo: h.new_rating }))

  // Confrontations directes (uniquement pertinent si on regarde le profil d'un autre joueur)
  const h2h = !isOwn && me
    ? matches.filter((m) => (m.player1_id === me.id || m.player2_id === me.id))
    : []
  const h2hWins = h2h.filter((m) => m.winner_id === me?.id).length
  const h2hLosses = h2h.filter((m) => m.winner_id === profile.id).length
  const h2hDraws = h2h.length - h2hWins - h2hLosses

  return (
    <div className="space-y-4">
      <div className="relative">
        <PlayerCardLarge player={profile} />
        {isOwn && (
          <div className="absolute top-3 right-3 flex gap-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded-full bg-black/40 backdrop-blur border border-white/15 hover:bg-black/60 transition-colors disabled:opacity-50"
              title="Changer la photo de profil"
            >
              <Camera size={15} />
            </button>
            {profile.avatar_url && (
              <button
                onClick={handleRemove}
                disabled={uploading}
                className="p-2 rounded-full bg-black/40 backdrop-blur border border-white/15 hover:bg-crimson/40 transition-colors disabled:opacity-50"
                title="Supprimer la photo"
              >
                <Trash2 size={15} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="hidden" />
          </div>
        )}
      </div>

      {chartData.length > 1 && (
        <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-dim mb-2">Évolution ELO</div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="eloGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4FD87F" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#4FD87F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['dataMin - 20', 'dataMax + 20']} hide />
                <Area type="monotone" dataKey="elo" stroke="#4FD87F" strokeWidth={2} fill="url(#eloGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!isOwn && me && h2h.length > 0 && (
        <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Swords size={16} className="text-turf" />
            <h3 className="font-display text-lg tracking-wide">Face-à-face avec toi</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-turf/10 border border-turf/25 rounded-xl py-2">
              <div className="font-mono font-bold text-lg text-turf-bright">{h2hWins}</div>
              <div className="text-[10px] text-ink-faint uppercase">Tes victoires</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl py-2">
              <div className="font-mono font-bold text-lg">{h2hDraws}</div>
              <div className="text-[10px] text-ink-faint uppercase">Nuls</div>
            </div>
            <div className="bg-crimson/10 border border-crimson/25 rounded-xl py-2">
              <div className="font-mono font-bold text-lg text-crimson">{h2hLosses}</div>
              <div className="text-[10px] text-ink-faint uppercase">Ses victoires</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-pitch-panel border border-white/10 rounded-2xl p-4">
        <h3 className="font-display text-lg tracking-wide mb-2">Derniers matchs</h3>
        {matches.length === 0 ? (
          <p className="text-ink-dim text-sm">Aucun match confirmé pour l'instant.</p>
        ) : (
          <div className="space-y-1.5">
            {matches.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar username={m.player1?.username ?? '?'} avatarUrl={m.player1?.avatar_url ?? null} size="xs" />
                  <span className="truncate text-ink-dim">{m.player1?.username} vs {m.player2?.username}</span>
                  <Avatar username={m.player2?.username ?? '?'} avatarUrl={m.player2?.avatar_url ?? null} size="xs" />
                </div>
                <span className="font-mono font-semibold shrink-0 ml-2">{m.player1_score}–{m.player2_score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
