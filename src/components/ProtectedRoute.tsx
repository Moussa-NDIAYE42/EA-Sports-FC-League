import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-ink-dim text-sm">Chargement…</div>
  }
  if (!user) return <Navigate to="/login" replace />
  if (!profile) {
    // Compte auth existant mais pas encore de profil = invitation jamais réclamée
    return <Navigate to="/login" replace />
  }
  if (adminOnly && profile.role !== 'admin') return <Navigate to="/" replace />

  return <>{children}</>
}
