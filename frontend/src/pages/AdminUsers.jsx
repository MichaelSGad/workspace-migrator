import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ChevronLeft, UserPlus, Trash2, Shield, User, Loader, XCircle } from 'lucide-react'

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    api.getAdminUsers()
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function createUser(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const u = await api.createAdminUser(email, password)
      setUsers(prev => [...prev, u])
      setEmail('')
      setPassword('')
      setShowForm(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(id) {
    try {
      await api.deleteAdminUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      alert(err.message)
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="page-bg min-h-screen">
      <header className="border-b border-indigo-500/20 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-ghost text-sm flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> Tilbage
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <span className="font-display font-bold text-white">Brugerstyring</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Brugere</h1>
            <p className="text-slate-400 text-sm mt-1">Administrér hvem der har adgang til Workspace Migrator</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
            <UserPlus className="w-4 h-4" /> Tilføj bruger
          </button>
        </div>

        {error && (
          <div className="card p-4 flex items-center gap-2 text-red-400 text-sm mb-4">
            <XCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <div className="card divide-y divide-slate-800/60">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${u.is_admin ? 'bg-indigo-500/20' : 'bg-navy-700'}`}>
                  {u.is_admin
                    ? <Shield className="w-4 h-4 text-indigo-400" />
                    : <User className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{u.email}</div>
                  <div className="text-xs text-slate-500">{u.is_admin ? 'Administrator' : 'Bruger'}</div>
                </div>
                {confirmDelete === u.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">Slet bruger?</span>
                    <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-xs py-1 px-2">Annuller</button>
                    <button onClick={() => deleteUser(u.id)} className="btn-danger text-xs py-1 px-2 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Bekræft
                    </button>
                  </div>
                ) : (
                  !u.is_admin && (
                    <button onClick={() => setConfirmDelete(u.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add user modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-sm animate-slide-up">
              <h3 className="font-display text-lg font-bold text-white mb-4">Tilføj bruger</h3>
              <form onSubmit={createUser} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="input" placeholder="bruger@eksempel.dk" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Adgangskode</label>
                  <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                    className="input" placeholder="Min. 8 tegn" />
                </div>
                {formError && <p className="text-xs text-red-400">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuller</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Opret
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
