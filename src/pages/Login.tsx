import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Mode = 'signin' | 'signup'

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(traduireErreur(error.message)); return }
    navigate('/')
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Le code d'invitation et le pseudo sont passés en métadonnées du compte.
      // Un trigger côté base de données (handle_new_user) crée le profil dès
      // la création du compte, indépendamment de la confirmation email —
      // voir supabase/migrations/002_fix_invite_on_signup.sql
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            invite_code: inviteCode.trim(),
            username: username.trim(),
          },
        },
      })
      if (signUpError) throw signUpError

      if (!signUpData.session) {
        // Confirmation email activée sur le projet Supabase : le profil est
        // déjà créé côté serveur, il ne reste qu'à confirmer puis se connecter.
        setError('Compte créé ! Vérifie ta boîte mail, clique sur le lien de confirmation, puis reviens te connecter ici.')
        setMode('signin')
        setLoading(false)
        return
      }

      // Confirmation email désactivée : session immédiate, le profil existe déjà.
      await refreshProfile()
      navigate('/')
    } catch (err: any) {
      setError(traduireErreur(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-stadium pointer-events-none" />
      <div className="w-full max-w-sm bg-pitch-panel border border-white/10 rounded-2xl p-6 relative shadow-card animate-scale-in">
        <div className="text-center mb-6">
          <div className="text-turf text-[11px] tracking-[3px] font-mono uppercase">FC26 · Ligue privée</div>
          <h1 className="font-display text-5xl mt-1 bg-gradient-to-b from-ink to-turf-bright bg-clip-text text-transparent">ELO LEAGUE</h1>
          <p className="text-ink-dim text-xs mt-1">Accès réservé aux membres invités — 20 places max.</p>
        </div>

        <div className="flex gap-2 bg-pitch rounded-xl p-1 mb-5">
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signin' ? 'bg-turf text-pitch' : 'text-ink-dim'}`}
            onClick={() => setMode('signin')}
          >
            Connexion
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-turf text-pitch' : 'text-ink-dim'}`}
            onClick={() => setMode('signup')}
          >
            J'ai un code
          </button>
        </div>

        <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
          {mode === 'signup' && (
            <>
              <Field label="Code d'invitation" value={inviteCode} onChange={setInviteCode} placeholder="COUSINS-2026" />
              <Field label="Pseudo" value={username} onChange={setUsername} placeholder="Karim" />
            </>
          )}
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="toi@exemple.com" />
          <Field label="Mot de passe" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

          {error && <div className="text-crimson text-xs bg-crimson/10 border border-crimson/30 rounded-lg p-2">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-turf text-pitch font-bold py-3 rounded-lg mt-2 disabled:opacity-50"
          >
            {loading ? 'Patiente…' : mode === 'signin' ? 'Se connecter' : "Rejoindre la ligue"}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-ink-dim mb-1">{label}</label>
      <input
        required
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-pitch-raised border border-white/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-turf"
      />
    </div>
  )
}

function traduireErreur(msg?: string): string {
  if (!msg) return "Une erreur est survenue. Vérifie ton code d'invitation (il est peut-être déjà utilisé) ou réessaie."
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('Database error saving new user')) return "Code d'invitation invalide, déjà utilisé, ou ligue complète (20/20). Vérifie auprès de l'administrateur."
  if (msg.includes('complète')) return msg
  if (msg.includes('invalide')) return msg
  return msg
}
