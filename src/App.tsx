import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Leaderboard } from '@/pages/Leaderboard'
import { NewMatch } from '@/pages/NewMatch'
import { History } from '@/pages/History'
import { Profile } from '@/pages/Profile'
import { Admin } from '@/pages/Admin'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Leaderboard />} />
              <Route path="/match/new" element={<NewMatch />} />
              <Route path="/history" element={<History />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:id" element={<Profile />} />
            </Route>
            <Route path="/admin" element={<ProtectedRoute adminOnly><Layout /></ProtectedRoute>}>
              <Route index element={<Admin />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
