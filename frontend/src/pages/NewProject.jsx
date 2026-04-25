import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import {
  ChevronRight, ChevronLeft, Upload, X, Plus, Mail, HardDrive,
  Calendar, Users, Check, AlertCircle, FileText, Layers
} from 'lucide-react'

const STEPS = ['Navn', 'Kilde', 'Mål', 'Brugere', 'Services']

const SERVICES = [
  { id: 'gmail', label: 'Gmail', icon: Mail, desc: 'Emails, labels og vedhæftede filer' },
  { id: 'drive', label: 'Drive', icon: HardDrive, desc: 'Filer, mapper og Google Docs/Sheets/Slides' },
  { id: 'calendar', label: 'Kalender', icon: Calendar, desc: 'Begivenheder og tilbagevendende aftaler' },
  { id: 'contacts', label: 'Kontakter', icon: Users, desc: 'Alle kontakter med alle felter' },
]

function FileDropZone({ label, file, onFile }) {
  const [dragging, setDragging] = useState(false)
  const ref = useRef()

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      className={`drop-zone rounded-xl p-6 text-center cursor-pointer ${dragging ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => ref.current.click()}
    >
      <input ref={ref} type="file" accept=".json" className="hidden" onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-emerald-400 font-medium text-sm">{file.name}</p>
            <p className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={e => { e.stopPropagation(); onFile(null) }} className="ml-2 text-slate-500 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
          <p className="text-sm text-slate-300 font-medium">{label}</p>
          <p className="text-xs text-slate-500 mt-1">Træk JSON-fil hertil eller klik</p>
        </>
      )}
    </div>
  )
}

export default function NewProject() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [sourceDomain, setSourceDomain] = useState('')
  const [sourceSA, setSourceSA] = useState(null)
  const [targetDomain, setTargetDomain] = useState('')
  const [targetSA, setTargetSA] = useState(null)
  const [userPairs, setUserPairs] = useState([{ source: '', target: '' }])
  const [services, setServices] = useState(['gmail', 'drive'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const csvRef = useRef()

  function toggleService(id) {
    setServices(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function addPair() {
    setUserPairs(p => [...p, { source: '', target: '' }])
  }

  function removePair(i) {
    setUserPairs(p => p.filter((_, idx) => idx !== i))
  }

  function updatePair(i, field, val) {
    setUserPairs(p => p.map((pair, idx) => idx === i ? { ...pair, [field]: val } : pair))
  }

  function importCSV(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').filter(Boolean)
      const pairs = lines.map(l => {
        const [source, target] = l.split(/[,;]/).map(s => s.trim())
        return { source: source || '', target: target || '' }
      }).filter(p => p.source && p.target)
      if (pairs.length) setUserPairs(pairs)
    }
    reader.readAsText(file)
  }

  function canProceed() {
    if (step === 0) return name.trim().length > 0
    if (step === 1) return sourceDomain.trim() && sourceSA
    if (step === 2) return targetDomain.trim() && targetSA
    if (step === 3) return userPairs.some(p => p.source && p.target)
    if (step === 4) return services.length > 0
    return true
  }

  async function handleFinish() {
    setError('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('source_domain', sourceDomain)
      formData.append('target_domain', targetDomain)
      formData.append('source_sa_key', sourceSA)
      formData.append('target_sa_key', targetSA)

      const project = await api.createProject(formData)

      const validPairs = userPairs.filter(p => p.source && p.target)
      await Promise.all(validPairs.map(p =>
        api.addProjectUser(project.id, { source_email: p.source, target_email: p.target })
      ))

      const job = await api.createJob(project.id, services)
      navigate(`/jobs/${job.id}`)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="page-bg min-h-screen">
      {/* Header */}
      <header className="border-b border-indigo-500/20 bg-navy-900/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-ghost text-sm flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> Tilbage
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <Layers className="w-3 h-3 text-white" />
            </div>
            <span className="font-display font-semibold text-white text-sm">Nyt projekt</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                ${i < step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                  i === step ? 'step-active text-white' :
                  'bg-navy-700 text-slate-500 border border-slate-700'}`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${i === step ? 'text-white' : 'text-slate-500'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="card p-8 animate-fade-in" key={step}>
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">Projektnavn</h2>
              <p className="text-slate-400 mb-6">Giv projektet et navn der beskriver hvad der migreres.</p>
              <label className="label">Projektnavn</label>
              <input className="input text-lg" placeholder="fx Vindrose migration 2025" value={name}
                onChange={e => setName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && canProceed() && setStep(1)} />
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">Kilde-Workspace</h2>
              <p className="text-slate-400 mb-6">Den Google Workspace I migrerer <em>fra</em>.</p>
              <div className="space-y-5">
                <div>
                  <label className="label">Domæne</label>
                  <input className="input font-mono" placeholder="old-company.com" value={sourceDomain}
                    onChange={e => setSourceDomain(e.target.value)} />
                </div>
                <div>
                  <label className="label">Service account nøgle (JSON)</label>
                  <FileDropZone label="Upload source-sa-key.json" file={sourceSA} onFile={setSourceSA} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">Mål-Workspace</h2>
              <p className="text-slate-400 mb-6">Den Google Workspace I migrerer <em>til</em>.</p>
              <div className="space-y-5">
                <div>
                  <label className="label">Domæne</label>
                  <input className="input font-mono" placeholder="new-company.com" value={targetDomain}
                    onChange={e => setTargetDomain(e.target.value)} />
                </div>
                <div>
                  <label className="label">Service account nøgle (JSON)</label>
                  <FileDropZone label="Upload target-sa-key.json" file={targetSA} onFile={setTargetSA} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">Brugere</h2>
              <p className="text-slate-400 mb-6">Mapning af kilde-email til mål-email for hver bruger.</p>

              <div className="grid grid-cols-2 gap-3 mb-3 px-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Kilde-email</span>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mål-email</span>
              </div>

              <div className="space-y-2 mb-4">
                {userPairs.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className="input font-mono text-sm py-2" placeholder={`bruger@${sourceDomain || 'kilde.com'}`}
                      value={pair.source} onChange={e => updatePair(i, 'source', e.target.value)} />
                    <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <input className="input font-mono text-sm py-2" placeholder={`bruger@${targetDomain || 'mål.com'}`}
                      value={pair.target} onChange={e => updatePair(i, 'target', e.target.value)} />
                    <button onClick={() => removePair(i)} disabled={userPairs.length === 1}
                      className="text-slate-600 hover:text-red-400 disabled:opacity-30 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={addPair} className="btn-secondary flex items-center gap-2 text-sm py-2">
                  <Plus className="w-4 h-4" /> Tilføj bruger
                </button>
                <button onClick={() => csvRef.current.click()} className="btn-ghost text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Importer CSV
                </button>
                <input ref={csvRef} type="file" accept=".csv,.txt" className="hidden" onChange={importCSV} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">Vælg services</h2>
              <p className="text-slate-400 mb-6">Hvad skal migreres? Du kan vælge flere.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {SERVICES.map(svc => {
                  const Icon = svc.icon
                  const active = services.includes(svc.id)
                  return (
                    <button key={svc.id} onClick={() => toggleService(svc.id)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        active
                          ? 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_16px_rgba(99,102,241,0.2)]'
                          : 'border-slate-700 bg-navy-800 hover:border-slate-600'
                      }`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-600' : 'bg-navy-700'}`}>
                          <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${active ? 'text-white' : 'text-slate-300'}`}>{svc.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{svc.desc}</p>
                        </div>
                        {active && <Check className="w-4 h-4 text-indigo-400 ml-auto flex-shrink-0 mt-0.5" />}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="bg-navy-900 rounded-xl p-4 border border-slate-800 space-y-2 text-sm mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>Projekt</span>
                  <span className="text-white font-medium">{name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Rute</span>
                  <span className="font-mono text-xs text-indigo-300">{sourceDomain} → {targetDomain}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Brugere</span>
                  <span className="text-white">{userPairs.filter(p => p.source && p.target).length}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Services</span>
                  <span className="text-white">{services.join(', ') || '—'}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> Tilbage
          </button>

          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="btn-primary flex items-center gap-2">
              Næste <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={!canProceed() || loading} className="btn-primary flex items-center gap-2 px-6">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Starter…</>
              ) : (
                <><Check className="w-4 h-4" /> Start migration</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
