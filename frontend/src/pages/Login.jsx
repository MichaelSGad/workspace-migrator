import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken, getToken } from '../api/client'
import { ArrowRight, Layers, AlertCircle } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [isSetup, setIsSetup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (getToken()) { navigate('/'); return }
    api.needsSetup().then(r => {
      setIsSetup(r.needs_setup)
      setChecking(false)
    }).catch(() => setChecking(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = isSetup
        ? await api.setup(email, password)
        : await api.login(email, password)
      setToken(res.access_token)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="page-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="page-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold text-white tracking-tight">
            Workspace Migrator
          </span>
        </div>

        <div className="card p-8">
          <h1 className="font-display text-2xl font-bold text-white mb-1">
            {isSetup ? 'Opret admin-konto' : 'Log ind'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isSetup
              ? 'Første bruger bliver automatisk administrator.'
              : 'Velkommen tilbage.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="dig@firma.dk"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Adgangskode</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isSetup ? 'Opret konto' : 'Log ind'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
