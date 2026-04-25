import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ChevronLeft, Users, Play, Trash2, MoveRight, Mail, HardDrive, Calendar, ExternalLink, Loader } from 'lucide-react'

const SERVICE_ICONS = { gmail: Mail, drive: HardDrive, calendar: Calendar, contacts: Users }
const STATUS_LABELS = { running: 'Kører', done: 'Færdig', failed: 'Fejlet', pending: 'Afventer', cancelled: 'Annulleret' }
const STATUS_CLASSES = { running: 'badge-running', done: 'badge-done', failed: 'badge-failed', pending: 'badge-pending', cancelled: 'badge-cancelled' }

function StatusBadge({ status }) {
  const dots = { running: 'bg-blue-400 animate-pulse', done: 'bg-emerald-400', failed: 'bg-red-400', pending: 'bg-slate-400', cancelled: 'bg-amber-400' }
  return (
    <span className={STATUS_CLASSES[status] || 'badge-pending'}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] || 'bg-slate-400'}`} />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [selectedServices, setSelectedServices] = useState(['gmail', 'drive', 'calendar', 'contacts'])
  const [showServicePicker, setShowServicePicker] = useState(false)

  useEffect(() => {
    Promise.all([api.getProject(id), api.getJobs(id)])
      .then(([p, j]) => { setProject(p); setJobs(j.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  async function startNewJob() {
    setStarting(true)
    try {
      const job = await api.createJob(id, selectedServices)
      navigate(`/jobs/${job.id}`)
    } catch (err) {
      alert(err.message)
      setStarting(false)
    }
  }

  if (loading) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <Loader className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  )

  if (!project) return null

  return (
    <div className="page-bg min-h-screen">
      <header className="border-b border-indigo-500/20 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-ghost text-sm flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> Tilbage
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <span className="font-display font-bold text-white">{project.name}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Project info */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-white mb-2">{project.name}</h1>
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded">{project.source_domain}</span>
                <MoveRight className="w-4 h-4 text-slate-500" />
                <span className="text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded">{project.target_domain}</span>
              </div>
            </div>
            <button onClick={() => setShowServicePicker(true)} className="btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" /> Start migration
            </button>
          </div>
        </div>

        {/* Service picker modal */}
        {showServicePicker && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-sm animate-slide-up">
              <h3 className="font-display text-lg font-bold text-white mb-4">Vælg services</h3>
              <div className="space-y-2 mb-6">
                {['gmail', 'drive', 'calendar', 'contacts'].map(svc => {
                  const Icon = SERVICE_ICONS[svc]
                  const active = selectedServices.includes(svc)
                  return (
                    <button key={svc} onClick={() => setSelectedServices(s => s.includes(svc) ? s.filter(x => x !== svc) : [...s, svc])}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${active ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                      <Icon className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span className={`text-sm font-medium capitalize ${active ? 'text-white' : 'text-slate-400'}`}>{svc}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowServicePicker(false)} className="btn-secondary flex-1">Annuller</button>
                <button onClick={() => { setShowServicePicker(false); startNewJob() }} disabled={selectedServices.length === 0 || starting}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {starting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
                  Start
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        <div>
          <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Brugere ({project.user_pairs?.length || 0})
          </h2>
          <div className="card divide-y divide-slate-800/60">
            {project.user_pairs?.map((pair, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm font-mono">
                <span className="text-indigo-300">{pair.source_email}</span>
                <MoveRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                <span className="text-emerald-300">{pair.target_email}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Jobs */}
        <div>
          <h2 className="font-display text-lg font-semibold text-white mb-3">Migrationshistorik</h2>
          {jobs.length === 0 ? (
            <div className="card flex items-center justify-center py-10 text-slate-500 text-sm">
              Ingen jobs endnu
            </div>
          ) : (
            <div className="card divide-y divide-slate-800/60">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center gap-4 px-5 py-4">
                  <StatusBadge status={job.status} />
                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                    {job.services?.map(s => {
                      const Icon = SERVICE_ICONS[s]
                      return Icon ? <div key={s} title={s} className="w-6 h-6 bg-navy-700 rounded flex items-center justify-center">
                        <Icon className="w-3 h-3 text-slate-400" />
                      </div> : null
                    })}
                  </div>
                  <span className="text-xs text-slate-500 font-mono flex-shrink-0">
                    {new Date(job.created_at).toLocaleString('da-DK')}
                  </span>
                  <button onClick={() => navigate(`/jobs/${job.id}`)}
                    className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm flex-shrink-0">
                    Vis <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
