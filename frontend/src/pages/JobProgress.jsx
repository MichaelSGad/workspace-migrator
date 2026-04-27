import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ChevronLeft, Mail, HardDrive, Calendar, Users, ChevronDown, ChevronUp, MoveRight, Loader, CheckCircle2, XCircle, Clock } from 'lucide-react'

const SERVICE_ICONS = { gmail: Mail, drive: HardDrive, calendar: Calendar, contacts: Users }
const SERVICE_LABELS = { gmail: 'Gmail', drive: 'Drive', calendar: 'Kalender', contacts: 'Kontakter' }
const STATUS_LABELS = { running: 'Kører', done: 'Færdig', failed: 'Fejlet', pending: 'Afventer', cancelled: 'Annulleret' }

const STATUS_BADGE = {
  running: <span className="badge-running"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />Kører</span>,
  done: <span className="badge-done"><CheckCircle2 className="w-3 h-3" />Færdig</span>,
  failed: <span className="badge-failed"><XCircle className="w-3 h-3" />Fejlet</span>,
  pending: <span className="badge-pending"><Clock className="w-3 h-3" />Afventer</span>,
  cancelled: <span className="badge-cancelled">Annulleret</span>,
}

function Confetti() {
  const colors = ['#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    size: Math.random() * 6 + 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: Math.random() > 0.5 ? '50%' : '2px',
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          backgroundColor: p.color,
          width: p.size,
          height: p.size,
          borderRadius: p.shape,
        }} />
      ))}
    </div>
  )
}

function ProgressCard({ item }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = SERVICE_ICONS[item.service] || Mail
  const pct = item.total > 0 ? Math.round((item.migrated / item.total) * 100) : 0

  return (
    <div className={`card p-5 transition-all duration-300 ${item.status === 'running' ? 'border-indigo-500/40 shadow-[0_0_16px_rgba(99,102,241,0.1)]' : ''}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          item.status === 'done' ? 'bg-emerald-500/20' :
          item.status === 'failed' ? 'bg-red-500/20' :
          item.status === 'running' ? 'bg-indigo-500/20' : 'bg-navy-700'
        }`}>
          <Icon className={`w-4 h-4 ${
            item.status === 'done' ? 'text-emerald-400' :
            item.status === 'failed' ? 'text-red-400' :
            item.status === 'running' ? 'text-indigo-400' : 'text-slate-500'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{SERVICE_LABELS[item.service] || item.service}</span>
            {STATUS_BADGE[item.status] || <span className="badge-pending">{item.status}</span>}
          </div>
          <div className="flex items-center gap-1 text-xs font-mono text-slate-500 truncate">
            <span className="truncate">{item.source_email}</span>
            <MoveRight className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{item.target_email}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-navy-900 rounded-full overflow-hidden mb-3">
        {item.status === 'running' ? (
          <div className="h-full progress-bar rounded-full" style={{ width: item.total > 0 ? `${pct}%` : '30%' }} />
        ) : (
          <div className={`h-full rounded-full transition-all duration-500 ${
            item.status === 'done' ? 'bg-emerald-500' :
            item.status === 'failed' ? 'bg-red-500' : 'bg-slate-700'
          }`} style={{ width: `${pct}%` }} />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        {[
          { label: 'Migreret', value: item.migrated, color: 'text-emerald-400' },
          { label: 'Sprunget over', value: item.skipped, color: 'text-slate-400' },
          { label: 'Fejlede', value: item.failed_count, color: item.failed_count > 0 ? 'text-red-400' : 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="bg-navy-900/60 rounded-lg p-2">
            <div className={`text-lg font-display font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Log */}
      {item.log_tail && (
        <div>
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors w-full">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Log
          </button>
          {expanded && (
            <div className="mt-2 bg-navy-950 rounded-lg p-3 font-mono text-xs text-slate-400 max-h-32 overflow-y-auto">
              {item.log_tail.split('\n').slice(-10).map((line, i) => (
                <div key={i} className="py-0.5 border-b border-slate-800/50 last:border-0">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function JobProgress() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const wasRunning = useRef(false)
  const esRef = useRef(null)

  useEffect(() => {
    api.getJob(id).then(j => { setJob(j); setLoading(false) }).catch(() => setLoading(false))

    const es = api.streamJob(id)
    esRef.current = es

    es.onmessage = e => {
      const data = JSON.parse(e.data)
      if (data.error) return

      setJob(prev => {
        const updated = {
          ...prev,
          status: data.status,
          progress: data.progress,
        }
        if (wasRunning.current && data.status === 'done') {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 4000)
        }
        if (data.status === 'running') wasRunning.current = true
        return updated
      })

      if (['done', 'failed', 'cancelled'].includes(data.status)) {
        es.close()
      }
    }

    es.onerror = () => es.close()

    return () => es.close()
  }, [id])

  const overallStatus = job?.status || 'pending'
  const grouped = {}
  job?.progress?.forEach(p => {
    const key = p.source_email
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p)
  })

  const totalMigrated = job?.progress?.reduce((s, p) => s + p.migrated, 0) || 0
  const totalFailed = job?.progress?.reduce((s, p) => s + p.failed_count, 0) || 0

  if (loading) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <Loader className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  )

  return (
    <div className="page-bg min-h-screen">
      {showConfetti && <Confetti />}

      <header className="border-b border-indigo-500/20 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> Tilbage
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <span className="font-mono text-xs text-slate-500">{id.substring(0, 8)}…</span>
          {STATUS_BADGE[overallStatus]}

          {overallStatus === 'done' && (
            <div className="ml-auto flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-semibold">Migration fuldført!</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Summary bar */}
        {job && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Status', value: STATUS_LABELS?.[overallStatus] || overallStatus, sub: null },
              { label: 'Migreret i alt', value: totalMigrated.toLocaleString(), sub: null },
              { label: 'Fejlede i alt', value: totalFailed.toLocaleString(), sub: null },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <div className="text-2xl font-display font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Progress cards per user */}
        {Object.entries(grouped).map(([userEmail, items]) => (
          <div key={userEmail} className="mb-8">
            <h3 className="font-mono text-sm text-slate-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              {userEmail}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {items.map(item => <ProgressCard key={item.id} item={item} />)}
            </div>
          </div>
        ))}

        {(!job?.progress || job.progress.length === 0) && (
          <div className="card flex items-center justify-center py-16 text-slate-500">
            <Loader className="w-5 h-5 animate-spin mr-2" /> Forbereder migration…
          </div>
        )}

        {overallStatus === 'running' && (
          <div className="mt-4 flex justify-center">
            <button onClick={() => api.stopJob(id)} className="btn-ghost text-red-400 hover:text-red-300 text-sm">
              Stop migration
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
