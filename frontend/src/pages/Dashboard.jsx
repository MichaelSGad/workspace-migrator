import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken } from '../api/client'
import { Layers, Plus, ArrowRight, Users, LogOut, MoveRight, Database, Inbox, Loader } from 'lucide-react'

function StatusBadge({ jobs }) {
  if (!jobs || jobs.length === 0) return <span className="badge-pending">Ingen jobs</span>
  const latest = jobs[jobs.length - 1]
  const map = { running: 'badge-running', done: 'badge-done', failed: 'badge-failed', pending: 'badge-pending', cancelled: 'badge-cancelled' }
  const labels = { running: 'Kører', done: 'Færdig', failed: 'Fejlet', pending: 'Afventer', cancelled: 'Annulleret' }
  const dots = { running: 'bg-blue-400 animate-pulse', done: 'bg-emerald-400', failed: 'bg-red-400', pending: 'bg-slate-400', cancelled: 'bg-amber-400' }
  return (
    <span className={map[latest.status] || 'badge-pending'}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[latest.status] || 'bg-slate-400'}`} />
      {labels[latest.status] || latest.status}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    Promise.all([api.getProjects(), api.me()])
      .then(([projs, u]) => { setProjects(projs); setUser(u) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function logout() {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="page-bg min-h-screen">
      {/* Header */}
      <header className="border-b border-indigo-500/20 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.4)]">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold text-white">Workspace Migrator</span>
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-slate-400 font-mono">{user.email}</span>}
            <button onClick={logout} className="btn-ghost flex items-center gap-2 text-sm">
              <LogOut className="w-4 h-4" />
              Log ud
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Dine migrationsprojekter</h1>
            <p className="text-slate-400 mt-1">Administrér og kør Google Workspace migrationer</p>
          </div>
          <button onClick={() => navigate('/projects/new')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nyt projekt
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-navy-700 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/20">
              <Database className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="font-display text-xl font-bold text-white mb-2">Ingen projekter endnu</h2>
            <p className="text-slate-400 mb-6 max-w-xs">Opret dit første migrationsprojekt for at komme i gang</p>
            <button onClick={() => navigate('/projects/new')} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Opret projekt
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p, i) => (
              <div
                key={p.id}
                className="card-hover p-6 cursor-pointer animate-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-display text-lg font-semibold text-white">{p.name}</h3>
                  <StatusBadge jobs={p.jobs} />
                </div>

                <div className="flex items-center gap-2 text-sm font-mono mb-4">
                  <span className="text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">{p.source_domain}</span>
                  <MoveRight className="w-4 h-4 text-slate-500" />
                  <span className="text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded">{p.target_domain}</span>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {p.user_pairs?.length || 0} brugere
                  </span>
                  <span className="flex items-center gap-1 text-indigo-400 font-medium hover:text-indigo-300">
                    Åbn <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
