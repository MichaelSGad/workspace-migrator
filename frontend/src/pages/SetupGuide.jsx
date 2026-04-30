import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronDown, ChevronUp, Copy, CheckCircle2, ExternalLink, AlertTriangle, Info, XCircle } from 'lucide-react'

const SOURCE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(',')

const TARGET_SCOPES = [
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts',
].join(',')

function CopyBox({ text, label }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="mt-2 bg-navy-950 rounded-lg border border-slate-800">
      {label && <div className="px-3 pt-2 text-xs text-slate-500">{label}</div>}
      <div className="flex items-start gap-2 p-3">
        <code className="flex-1 text-xs text-emerald-300 font-mono break-all leading-relaxed">{text}</code>
        <button onClick={copy} className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Kopieret' : 'Kopiér'}
        </button>
      </div>
    </div>
  )
}

function Screenshot({ src, alt, caption }) {
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-slate-700/60">
      {src ? (
        <img src={src} alt={alt} className="w-full" />
      ) : (
        <div className="bg-navy-950 flex items-center justify-center py-10 text-slate-600 text-sm">
          [Screenshot: {alt}]
        </div>
      )}
      {caption && <div className="bg-navy-900/60 px-3 py-1.5 text-xs text-slate-500">{caption}</div>}
    </div>
  )
}

function Step({ number, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white mt-0.5">{number}</div>
      <div className="flex-1 pb-6 border-b border-slate-800/60 last:border-0">
        <h3 className="font-semibold text-white mb-2">{title}</h3>
        <div className="text-sm text-slate-300 space-y-2 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
        <div className="text-left">
          <div className="font-display font-bold text-white">{title}</div>
          {subtitle && <div className="text-sm text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-0 border-t border-slate-800/60 pt-5">{children}</div>}
    </div>
  )
}

export default function SetupGuide() {
  const navigate = useNavigate()

  return (
    <div className="page-bg min-h-screen">
      <header className="border-b border-indigo-500/20 bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-ghost text-sm flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" /> Tilbage
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <span className="font-display font-bold text-white">Opsætningsvejledning</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">

        {/* Intro */}
        <div className="card p-6">
          <h1 className="font-display text-2xl font-bold text-white mb-2">Google Service Account opsætning</h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Workspace Migrator bruger Google Service Accounts med <em>domain-wide delegation</em> til at
            kopiere data på vegne af brugerne. Du skal opsætte én service account for kildedomænet
            (kun læseadgang) og én for måldomænet (skriveadgang).
          </p>
          <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-relaxed">
              Du skal være <strong>Super Admin</strong> i begge Google Workspace-konti for at gennemføre opsætningen.
            </p>
          </div>
        </div>

        {/* Oversigt */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-white text-sm">Hvad du skal bruge</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Kildedomæne', items: ['Google Cloud projekt', 'Service account + JSON-nøgle', 'Domain-wide delegation (læs)'] },
              { label: 'Måldomæne', items: ['Google Cloud projekt', 'Service account + JSON-nøgle', 'Domain-wide delegation (skriv)'] },
            ].map(col => (
              <div key={col.label} className="bg-navy-900/60 rounded-lg p-3">
                <div className="font-medium text-slate-300 mb-2">{col.label}</div>
                <ul className="space-y-1">
                  {col.items.map(item => (
                    <li key={item} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Del 1: Google Cloud projekt */}
        <Section title="Del 1 — Google Cloud projekt og service account" subtitle="Gentages for både kilde- og måldomæne" defaultOpen={true}>
          <div className="space-y-0">
            <Step number="1" title="Opret et Google Cloud projekt">
              <p>Gå til <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">console.cloud.google.com <ExternalLink className="w-3 h-3" /></a></p>
              <p>Klik på projektmenuen øverst → <strong>"Nyt projekt"</strong>. Giv projektet et navn, f.eks. <em>"creagaia-migration"</em> eller <em>"gadconsulting-migration"</em>.</p>
              <Screenshot alt="Opret nyt Google Cloud projekt" caption="Klik på projektnavnet øverst til venstre for at åbne projektmenuen" src="/guide/01-new-project.png" />
            </Step>

            <Step number="2" title="Aktivér de nødvendige APIs">
              <p>Gå til <strong>APIs og tjenester → Bibliotek</strong> og søg efter og aktivér disse fire APIs:</p>
              <ul className="mt-1 space-y-1 ml-4">
                {['Gmail API', 'Google Drive API', 'Google Calendar API', 'People API'].map(api => (
                  <li key={api} className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> {api}
                  </li>
                ))}
              </ul>
              <Screenshot alt="Aktivér Gmail API i biblioteket" caption="Søg efter hvert API og klik 'Aktivér'" src="/guide/02-enable-apis.png" />
            </Step>

            <Step number="3" title="Opret en service account">
              <p>Gå til <strong>APIs og tjenester → Legitimationsoplysninger → Opret legitimationsoplysninger → Service account</strong>.</p>
              <p>Giv den et beskrivende navn, f.eks. <em>"workspace-migrator-source"</em>. Spring de valgfrie trin over og klik <strong>Udført</strong>.</p>
              <Screenshot alt="Opret service account" caption="Vælg 'Service account' under Opret legitimationsoplysninger" src="/guide/03-create-sa.png" />
            </Step>

            <Step number="4" title="Download JSON-nøglen">
              <p>Klik på den nyoprettede service account → fanen <strong>Nøgler</strong> → <strong>Tilføj nøgle → Opret ny nøgle → JSON</strong>.</p>
              <p>Gem JSON-filen sikkert — den bruges ved oprettelse af projektet i Workspace Migrator.</p>
              <Screenshot alt="Download JSON nøgle fra service account" caption="Vælg JSON-format og gem filen" src="/guide/04-download-key.png" />
            </Step>

            <Step number="5" title="Kopiér service account's klient-ID">
              <p>På service account-siden finder du <strong>Unik ID</strong> (et langt nummer). Kopiér det — du skal bruge det i næste del.</p>
              <Screenshot alt="Kopiér service account klient-ID" caption="Det unikke ID bruges til domain-wide delegation" src="/guide/05-client-id.png" />
            </Step>
          </div>
        </Section>

        {/* Del 2: Domain-wide delegation */}
        <Section title="Del 2 — Domain-wide delegation i Admin Console" subtitle="Gentages for begge domæner med forskellige scopes">
          <div className="space-y-0">
            <Step number="6" title="Åbn Google Workspace Admin Console">
              <p>Gå til <a href="https://admin.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">admin.google.com <ExternalLink className="w-3 h-3" /></a> og log ind som Super Admin for det pågældende domæne.</p>
              <Screenshot alt="Google Workspace Admin Console forside" src="/guide/06-admin-console.png" />
            </Step>

            <Step number="7" title="Naviger til domain-wide delegation">
              <p>Gå til <strong>Sikkerhed → Adgang og datakontrol → API-kontroller → Administrér domain-wide delegation</strong>.</p>
              <Screenshot alt="Naviger til domain-wide delegation" caption="Stien: Sikkerhed → API-kontroller → Domain-wide delegation" src="/guide/07-dwd-nav.png" />
            </Step>

            <Step number="8" title="Tilføj service account med scopes">
              <p>Klik <strong>"Tilføj ny"</strong>, indsæt klient-ID'et fra trin 5, og kopiér de relevante scopes herunder:</p>

              <div className="mt-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div className="text-xs font-semibold text-indigo-300 mb-2">Kildedomæne (kun læseadgang)</div>
                <CopyBox text={SOURCE_SCOPES} label="Indsæt i OAuth-scopes feltet:" />
              </div>

              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs font-semibold text-emerald-300 mb-2">Måldomæne (skriveadgang)</div>
                <CopyBox text={TARGET_SCOPES} label="Indsæt i OAuth-scopes feltet:" />
              </div>

              <Screenshot alt="Tilføj klient-ID og scopes i domain-wide delegation" caption="Indsæt klient-ID og scopelisten adskilt af kommaer" src="/guide/08-add-delegation.png" />
            </Step>
          </div>
        </Section>

        {/* Del 3: Brug i appen */}
        <Section title="Del 3 — Opret projekt i Workspace Migrator">
          <div className="space-y-0">
            <Step number="9" title="Opret et nyt projekt">
              <p>Gå til dashboardet og klik <strong>"Nyt projekt"</strong>. Du skal have følgende klar:</p>
              <ul className="mt-1 space-y-1 ml-4">
                {[
                  'Kildedomæne (f.eks. creagaia.com)',
                  'Måldomæne (f.eks. gadconsulting.dk)',
                  'JSON-nøgle for kildedomæne',
                  'JSON-nøgle for måldomæne',
                ].map(item => (
                  <li key={item} className="flex items-center gap-1.5 text-slate-300">
                    <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </Step>

            <Step number="10" title="Tilføj brugere og start migration">
              <p>Tilføj brugerpar (kilde-email → mål-email) og vælg hvilke services der skal migreres. Klik <strong>"Start migration"</strong> — og lad den køre.</p>
              <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200 leading-relaxed">
                  Migreringer kan tage fra minutter til mange timer afhængigt af datamængden. Du kan lukke browseren — du modtager en email når det er færdigt (hvis email er konfigureret).
                </p>
              </div>
            </Step>
          </div>
        </Section>

        {/* Fejlfinding */}
        <Section title="Fejlfinding — typiske problemer">
          <div className="space-y-3 text-sm">
            {[
              {
                problem: 'invalid_grant: Invalid email or User ID',
                fix: 'Brugeren eksisterer ikke i det pågældende Google Workspace, eller service account\'en mangler domain-wide delegation. Tjek at brugerens email er korrekt og aktiv.',
              },
              {
                problem: 'insufficientPermissions / Request had insufficient authentication scopes',
                fix: 'De forkerte OAuth-scopes er sat på delegation. Slet delegationen og tilføj den igen med de korrekte scopes fra del 2.',
              },
              {
                problem: 'Service account har ikke adgang til API',
                fix: 'Et eller flere APIs er ikke aktiveret i Google Cloud projektet. Gå til APIs og tjenester → Bibliotek og aktivér de manglende APIs.',
              },
              {
                problem: 'rateLimitExceeded / 429',
                fix: 'Google begrænser antallet af forespørgsler. Migreringen prøver automatisk igen. Du kan reducere hastigheden ved at køre færre services på samme tid.',
              },
            ].map(item => (
              <div key={item.problem} className="bg-navy-900/60 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <code className="text-xs text-red-300 font-mono">{item.problem}</code>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed ml-5">{item.fix}</p>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}
