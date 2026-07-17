import { NavLink, Outlet } from 'react-router-dom'
import { Trophy, Swords, History, User, ShieldCheck, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { RankBadge } from '@/components/ui/RankBadge'

const navItems = [
  { to: '/', label: 'Classement', icon: Trophy, end: true },
  { to: '/match/new', label: 'Nouveau match', icon: Swords },
  { to: '/history', label: 'Historique', icon: History },
  { to: '/profile', label: 'Profil', icon: User },
]

export function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 pb-24 pt-6">
      <header className="border-b border-white/10 pb-5 mb-6">
        <div className="flex items-center justify-center gap-2 text-turf text-[11px] tracking-[3px] font-mono uppercase">
          <span className="w-5 h-px bg-white/20" /> FC26 · Match Day <span className="w-5 h-px bg-white/20" />
        </div>
        <div className="flex items-center justify-center gap-3 mt-2">
          <img src="/logo-mark.svg" alt="" className="w-11 h-11 drop-shadow-[0_0_12px_rgba(231,180,38,0.35)]" />
          <h1 className="font-display text-5xl tracking-wide text-center bg-gradient-to-b from-ink to-ink-dim bg-clip-text text-transparent">
            ELO <span className="text-turf bg-none">LEAGUE</span>
          </h1>
        </div>

        {profile && (
          <div className="mt-4 flex items-center justify-between gap-3 bg-pitch-panel border border-white/10 rounded-2xl px-3 py-2.5">
            <NavLink to="/profile" className="flex items-center gap-2.5 min-w-0">
              <Avatar username={profile.username} avatarUrl={profile.avatar_url} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{profile.username}</div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-ink-dim">{profile.elo_rating} ELO</span>
                  <RankBadge elo={profile.elo_rating} size="sm" />
                </div>
              </div>
            </NavLink>
            <div className="flex items-center gap-3 shrink-0">
              {profile.role === 'admin' && (
                <NavLink to="/admin" className="inline-flex items-center gap-1 text-gold hover:underline text-xs font-semibold">
                  <ShieldCheck size={14} /> Admin
                </NavLink>
              )}
              <button onClick={signOut} className="inline-flex items-center gap-1 text-ink-faint hover:text-crimson transition-colors text-xs">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="animate-fade-in">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-pitch-panel/95 backdrop-blur border-t border-white/10 flex justify-around py-2 z-40">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? 'text-turf' : 'text-ink-faint hover:text-ink-dim'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
