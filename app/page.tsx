'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, BarChart3, Bell, BrainCircuit, Building2,
  Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Database, FileText, GitMerge,
  Layers3, Lightbulb, Menu, RotateCcw, ScanLine, Search, ShieldCheck, Sparkles,
  Upload, Users, Workflow, X, Zap,
} from 'lucide-react'
import {
  analyzeEvents, createSampleEvents, parseCsv,
  type Analysis, type Discovery, type EventRecord, type InterventionType, type ScenarioId,
} from './sentinel/engine'

type Scenario = Exclude<ScenarioId, 'upload'>
type View = 'overview' | 'xray' | 'hidden' | 'interventions' | 'simulator' | 'ingest'
type Screen = View | 'welcome' | 'setup'
type Simulation = { savedMinutes: number; affected: number; applied: boolean }

const scenarios: { id: Scenario; name: string; detail: string }[] = [
  { id: 'support', name: 'Customer support', detail: 'Cross-system search · response delays · handoffs' },
  { id: 'finance', name: 'Finance operations', detail: 'Reconciliation · duplicate entry · exceptions' },
  { id: 'hr', name: 'Human resources', detail: 'Approval loops · stalled handoffs · ownership' },
]
const nav: { id: View; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'xray', label: 'Workflow X-Ray', icon: ScanLine },
  { id: 'hidden', label: 'Hidden work', icon: Search },
  { id: 'interventions', label: 'Intervention engine', icon: GitMerge },
  { id: 'simulator', label: 'Impact simulator', icon: BarChart3 },
]
const phaseNames = ['Reconstructing workflows', 'Examining repeated activities', 'Comparing system transitions', 'Investigating bottlenecks', 'Evaluating interventions']
const interventionTypes: InterventionType[] = ['INTEGRATE', 'AI-ASSIST', 'AUTOMATE', 'HUMAN', 'REDESIGN', 'DO NOTHING']
const interventionCopy: Record<InterventionType, { detail: string; responsibility: string; complexity: string; risk: string }> = {
  INTEGRATE: { detail: 'Connect information flows at the source instead of automating a manual workaround.', responsibility: 'People retain judgment for customer outcomes and exceptions.', complexity: 'HIGH · systems and access review', risk: 'Validate integration quality, access controls, and source-of-truth ownership.' },
  'AI-ASSIST': { detail: 'Retrieve, summarize, or prepare context for a person to verify and act on.', responsibility: 'A human reviews generated context and owns the final decision.', complexity: 'MEDIUM · quality and review design', risk: 'Summaries can omit nuance or contain errors; source references and review are required.' },
  AUTOMATE: { detail: 'Use deterministic rules for stable, repeatable work with explicit exception routing.', responsibility: 'People review exceptions and remain accountable for outcomes.', complexity: 'MEDIUM · rule and exception design', risk: 'Bad source data and edge cases can produce incorrect matches; monitor exceptions.' },
  HUMAN: { detail: 'Keep this activity with an accountable person where context or nuanced judgment matters.', responsibility: 'A clearly named owner makes and documents the decision.', complexity: 'LOW · clarify decision ownership', risk: 'A human-owned process can still have bottlenecks; measure the outcome and workload.' },
  REDESIGN: { detail: 'Simplify the workflow, clarify ownership, or remove steps before adding technology.', responsibility: 'Process owners validate control coverage and approve changed paths.', complexity: 'MEDIUM · stakeholder and policy review', risk: 'Changing paths can alter control coverage; process owners should approve the new design.' },
  'DO NOTHING': { detail: 'Keep the current process until the evidence supports a proportionate change.', responsibility: 'Monitor outcomes and revisit if better evidence becomes available.', complexity: 'LOW · retain a baseline', risk: 'The event log may omit quality, policy, or customer outcome context.' },
}
const references: Record<Scenario, string[]> = {
  support: ['Open ticket', 'Check customer', 'Resolve ticket'],
  finance: ['Open batch', 'Match records', 'Review exceptions', 'Close batch'],
  hr: ['Open request', 'Review request', 'Approve request'],
}

function dateLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not available'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
function unique(values: (string | undefined)[]) { return [...new Set(values.filter((value): value is string => Boolean(value)))] }

export default function Home() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [scenario, setScenario] = useState<Scenario>('support')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [synthetic, setSynthetic] = useState(true)
  const [workflowMode, setWorkflowMode] = useState<'observed' | 'official'>('observed')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [activeFinding, setActiveFinding] = useState<Discovery | null>(null)
  const [selectedIntervention, setSelectedIntervention] = useState<InterventionType>('INTEGRATE')
  const [simulation, setSimulation] = useState<Simulation>({ savedMinutes: 10, affected: 68, applied: false })
  const [phase, setPhase] = useState(-1)
  const [timelineCount, setTimelineCount] = useState(0)
  const [filter, setFilter] = useState('ALL SIGNALS')
  const [csvFile, setCsvFile] = useState<string | null>(null)
  const [uploadEvents, setUploadEvents] = useState<EventRecord[] | null>(null)
  const [mappings, setMappings] = useState<string[]>([])
  const [csvError, setCsvError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const activeView = screen as View

  useEffect(() => {
    if (phase < 0) return
    const timer = window.setInterval(() => setPhase((current) => {
      if (current >= phaseNames.length - 1) {
        window.clearInterval(timer)
        setTimelineCount(5)
        return -1
      }
      setTimelineCount(Math.max(2, current + 1))
      return current + 1
    }), 520)
    return () => window.clearInterval(timer)
  }, [phase])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }
  const resetAnalysisState = () => {
    setSelectedNode(null)
    setActiveFinding(null)
    setWorkflowMode('observed')
    setFilter('ALL SIGNALS')
    setTimelineCount(2)
    setPhase(0)
  }
  const startSample = (id: Scenario) => {
    const events = createSampleEvents(id)
    const result = analyzeEvents(events, id)
    setScenario(id)
    setAnalysis(result)
    setSourceName(`${scenarios.find((item) => item.id === id)?.name} · ${result.stats.cases} cases`)
    setSynthetic(true)
    setUploadEvents(null)
    setCsvFile(null)
    setCsvError('')
    setSelectedIntervention(id === 'support' ? 'INTEGRATE' : id === 'finance' ? 'AUTOMATE' : 'REDESIGN')
    setSimulation({ savedMinutes: id === 'support' ? 10 : 8, affected: 68, applied: false })
    resetAnalysisState()
    setScreen('overview')
  }
  const chooseScenario = (id: Scenario) => {
    setScenario(id)
    setUploadEvents(null)
    setCsvFile(null)
    setCsvError('')
    setMappings([])
    setScreen('setup')
  }
  const parseFile = async (file?: File) => {
    if (!file) return
    setCsvError('')
    setMappings([])
    setUploadEvents(null)
    setCsvFile(file.name)
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setCsvError('Choose a .csv file. The file is parsed locally and is never sent to an external service.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setCsvError('This file is larger than the 20 MB limit. Choose a smaller CSV file.')
      return
    }
    setBusy(true)
    try {
      const parsed = parseCsv(await file.text())
      setUploadEvents(parsed.events)
      setMappings(parsed.mappings)
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'The CSV could not be read. Check its headers and try again.')
    } finally {
      setBusy(false)
    }
  }
  const analyzeUpload = () => {
    if (!uploadEvents) return
    const result = analyzeEvents(uploadEvents, 'upload')
    setAnalysis(result)
    setSynthetic(false)
    setSourceName(csvFile ?? 'Uploaded CSV')
    setSelectedIntervention(result.discoveries[0]?.intervention ?? 'DO NOTHING')
    setActiveFinding(null)
    setSelectedNode(null)
    setTimelineCount(2)
    setPhase(0)
    setSimulation({ savedMinutes: Math.min(20, Math.round(result.stats.avgDuration ? result.stats.avgDuration * 0.25 : 8)), affected: result.discoveries[0]?.percentage ?? 50, applied: false })
    setScreen('overview')
  }
  const traceFinding = (finding: Discovery) => {
    setActiveFinding(finding)
    setSelectedNode(finding.actions[0] ?? null)
    setWorkflowMode('observed')
    setScreen('xray')
  }
  const replay = () => {
    setTimelineCount(0)
    setPhase(0)
    notify('Investigation replay started.')
  }

  if (screen === 'welcome') return <Landing onStart={() => setScreen('setup')} onExplore={() => startSample('support')} />

  return (
    <main className="sentinel-app">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="topbar">
        <button className="brand-lockup" onClick={() => setScreen('welcome')} aria-label="BlindSpot home">
          <span className="brand-mark"><ScanLine size={18} /></span>
          <span className="brand-wordmark">BlindSpot<span>INVISIBLE WORK INTELLIGENCE</span></span>
        </button>
        <div className="topbar-context">
          <span className="context-label">ACTIVE INVESTIGATION</span>
          <label className="investigation-select-wrap">
            <select aria-label="Select investigation" value={scenario} onChange={(event) => chooseScenario(event.target.value as Scenario)}>
              {scenarios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select><ChevronDown size={13} />
          </label>
          <span className="topbar-divider" />
          <span className="period-label">{analysis?.stats.start ? `${dateLabel(analysis.stats.start)} — ${dateLabel(analysis.stats.end)}` : 'Select a data source'}</span>
        </div>
        <div className="topbar-actions">
          <span className={`data-badge ${!analysis ? 'pending' : synthetic ? 'demo' : 'uploaded'}`}><i />{!analysis ? 'NO DATA' : synthetic ? 'DEMO DATA' : 'LOCAL CSV'}</span>
          <button className="icon-button status-button" aria-label="System status: operational" title="System status: operational"><Bell size={16} /><i /></button>
          <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={18} /></button>
          <span className="avatar-mark">S</span>
        </div>
      </header>

      <div className="app-frame">
        <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <div className="sidebar-label">INVESTIGATION</div>
          <nav className="primary-nav" aria-label="Investigation modules">
            {nav.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${screen === id ? 'active' : ''}`} onClick={() => { setScreen(id); setMobileNav(false) }}>
                <Icon size={16} strokeWidth={1.7} /><span>{label}</span>
                {id === 'hidden' && analysis && <span className="nav-count">{analysis.discoveries.length}</span>}
                {screen === id && <i className="nav-active-indicator" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="pipeline-card">
              <div className="pipeline-head"><i />ENGINE STATUS</div>
              <strong>{analysis ? 'Analysis ready' : 'Awaiting data'}</strong>
              <span>LOCAL · RULE-BASED · TRACEABLE</span>
              <div className="pipeline-line"><i style={{ width: analysis ? '100%' : '9%' }} /></div>
            </div>
            <button className="sidebar-link" onClick={() => setScreen('ingest')}><Database size={14} /> Data sources <ArrowRight size={12} /></button>
            <button className="sidebar-link" onClick={() => notify('All calculations run locally in your browser. No external AI or API is connected.')}><CircleHelp size={14} /> About this engine <ArrowRight size={12} /></button>
            <div className="sidebar-foot"><ShieldCheck size={12} /> PRIVATE BY DESIGN <span>v0.9.4</span></div>
          </div>
        </aside>

        <section className="workspace">
          {screen === 'setup' || screen === 'ingest' ? (
            <SetupView scenario={scenario} fileName={csvFile} uploadEvents={uploadEvents} mappings={mappings} error={csvError} busy={busy} dragging={dragging} fileInput={fileInput}
              onFile={parseFile} onScenario={chooseScenario} onSample={() => startSample(scenario)} onAnalyze={analyzeUpload} onBack={() => setScreen(analysis ? 'overview' : 'welcome')}
              onPick={() => fileInput.current?.click()} onDrag={(value) => setDragging(value)} />
          ) : !analysis ? (
            <EmptyWorkspace onStart={() => setScreen('setup')} />
          ) : (
            <>
              <div className="workspace-head">
                <div>
                  <div className="eyebrow"><i /> OPERATIONAL INTELLIGENCE / {nav.find((item) => item.id === activeView)?.label.toUpperCase()}</div>
                  <h1>{activeView === 'overview' ? 'The work behind the work.' : activeView === 'xray' ? 'See the work systems miss.' : activeView === 'hidden' ? 'Invisible work, in evidence.' : activeView === 'interventions' ? 'Change the cause, not the workaround.' : 'Model the operational upside.'}</h1>
                  <p className="page-subtitle">{activeView === 'overview' ? 'A living reconstruction of how work moves across your organization.' : activeView === 'xray' ? 'Compare documented paths with event-derived sequences.' : activeView === 'hidden' ? 'Signals are calculated from selected records. Root causes remain hypotheses.' : activeView === 'interventions' ? 'Every recommendation is evidence-linked, reasoned, and open to comparison.' : 'Explore scenario assumptions before making an operational decision.'}</p>
                </div>
                <div className="workspace-head-actions">
                  <button className="quiet-button" onClick={replay}><RotateCcw size={13} /> Replay analysis</button>
                  <button className="primary-button compact" onClick={() => setScreen('setup')}><Database size={13} /> Change data</button>
                </div>
              </div>
              {phase >= 0 && <div className="analysis-ribbon"><span className="analysis-spinner"><ScanLine size={13} /></span><strong>{phaseNames[Math.max(0, phase)]}</strong><div className="phase-track">{phaseNames.map((_, index) => <i key={index} className={index <= phase ? 'filled' : ''} />)}</div><span>{phase + 1} / {phaseNames.length}</span></div>}
              {activeView === 'overview' && <Overview analysis={analysis} sourceName={sourceName} synthetic={synthetic} onNavigate={setScreen} onTrace={traceFinding} onNode={setSelectedNode} timelineCount={timelineCount} onTimeline={setTimelineCount} onReplay={replay} />}
              {activeView === 'xray' && <Xray analysis={analysis} scenario={scenario} synthetic={synthetic} mode={workflowMode} setMode={setWorkflowMode} selectedNode={selectedNode} setSelectedNode={setSelectedNode} activeFinding={activeFinding} />}
              {activeView === 'hidden' && <HiddenWork analysis={analysis} filter={filter} setFilter={setFilter} onTrace={traceFinding} onIntervention={(finding) => { setActiveFinding(finding); setSelectedIntervention(finding.intervention); setScreen('interventions') }} />}
              {activeView === 'interventions' && <Interventions analysis={analysis} scenario={scenario} selected={selectedIntervention} onSelect={setSelectedIntervention} activeFinding={activeFinding} onTrace={traceFinding} onSimulate={() => setScreen('simulator')} />}
              {activeView === 'simulator' && <Simulator analysis={analysis} scenario={scenario} selected={selectedIntervention} onSelect={setSelectedIntervention} simulation={simulation} setSimulation={setSimulation} synthetic={synthetic} onApplied={() => { setTimelineCount(6); notify('Scenario applied to this local simulation only.') }} />}
            </>
          )}
        </section>
      </div>
      {toast && <div className="toast-message" role="status"><Check size={14} />{toast}</div>}
    </main>
  )
}

function Landing({ onStart, onExplore }: { onStart: () => void; onExplore: () => void }) {
  const nodes = [
    { x: 14, y: 49, label: 'CRM', kind: 'base', detail: 'A case enters the system of record.' },
    { x: 37, y: 25, label: 'LOOKUP', kind: 'signal', detail: 'An employee searches across disconnected tools.' },
    { x: 62, y: 49, label: 'WAIT', kind: 'alert', detail: 'A hidden delay forms between system handoffs.' },
    { x: 37, y: 76, label: 'EMAIL', kind: 'signal', detail: 'Context moves through an untracked side channel.' },
    { x: 86, y: 49, label: 'RESOLVE', kind: 'base', detail: 'The customer receives a resolution.' },
  ]
  const [activeNode, setActiveNode] = useState('WAIT')
  const selectedNode = nodes.find((node) => node.label === activeNode) ?? nodes[2]
  return (
    <main className="landing-shell">
      <div className="landing-grid" aria-hidden="true" /><div className="landing-glow" aria-hidden="true" />
      <header className="landing-header">
        <a className="brand-lockup" href="#top"><span className="brand-mark"><ScanLine size={18} /></span><span className="brand-wordmark">BlindSpot<span>INVISIBLE WORK INTELLIGENCE</span></span></a>
        <div className="landing-status"><i /> INTELLIGENCE ENGINE <span>/</span> READY</div>
        <a className="landing-top-link" href="#method">THE METHOD <ArrowDownRight size={13} /></a>
      </header>
      <section className="landing-hero" id="top">
        <div className="hero-copy">
          <div className="hero-kicker"><i /> WORKFLOW INVESTIGATION SYSTEM <span>SYS / 01</span></div>
          <h1>Your organization<br />has a <em>hidden</em><br />operating system.</h1>
          <p>Discover the work your systems never recorded, understand why it exists, and simulate what should change before making a decision.</p>
          <div className="hero-actions"><button className="primary-button hero-cta" onClick={onStart}>INITIATE INVESTIGATION <ArrowRight size={15} /></button><button className="text-button" onClick={onExplore}><span className="play-mark">▶</span> EXPLORE SAMPLE INVESTIGATION</button></div>
          <div className="hero-assurance"><ShieldCheck size={13} /><span>LOCAL ANALYSIS</span><i /><span>NO API KEY REQUIRED</span><i /><span>TRACEABLE EVIDENCE</span></div>
        </div>
          <div className="hero-visual">
            <div className="visual-topline"><span><i /> LIVE WORKFLOW TRACE</span><span>CASE / 01842</span></div>
            <div className="hero-map"><div className="map-grid" />
              <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M14 49 L37 25 L62 49 L86 49 M14 49 L37 76 L62 49" /><path className="path-active" d="M14 49 L37 25 L62 49 L86 49" /><path className="path-dash" d="M14 49 L37 76 L62 49" /><circle className="flow-particle" r="1.15"><animateMotion dur="5.6s" repeatCount="indefinite" path="M14 49 L37 25 L62 49 L86 49" /></circle><circle className="flow-particle flow-particle-alt" r=".8"><animateMotion dur="7.2s" begin="-3s" repeatCount="indefinite" path="M14 49 L37 76 L62 49" /></circle></svg>
              {nodes.map((node) => <button type="button" key={node.label} className={`hero-node hero-node-${node.kind} ${activeNode === node.label ? 'hero-node-active' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setActiveNode(node.label)} aria-pressed={activeNode === node.label} aria-label={`Inspect ${node.label}: ${node.detail}`}><span>{node.kind === 'alert' ? <Clock3 size={12} /> : node.kind === 'signal' ? <Search size={12} /> : <Layers3 size={12} />}</span><b>{node.label}</b></button>)}
              <div className="scan-beam" /><div className="map-coord coord-one">OBSERVED / 07 STEPS</div><div className="map-coord coord-two">EVENT TRACE · LOCAL</div>
            </div>
            <div className="visual-foot"><span><i className="legend-dot cyan" /> RECORDED ACTIVITY</span><span><i className="legend-dot violet" /> INVISIBLE WORK</span><span>MODE <b>INVESTIGATE</b></span></div>
            <div className="hero-callout" aria-live="polite"><span><Sparkles size={14} /></span><div><small>LIVE SIGNAL / {selectedNode.label}</small><strong>{selectedNode.detail}</strong></div><ChevronRight size={14} /></div>
          </div>

      </section>
      <section className="landing-bottom" id="method">
        <div className="landing-bottom-label">ONE ENGINE. EVERY WORKFLOW.</div>
        <div className="landing-principle">“Don&apos;t automate the workaround.<br /><span>Discover and fix the reason it exists.”</span></div>
        <div className="landing-process">{[['01', 'RECONSTRUCT', 'Turn event data into the work as it happens.'], ['02', 'INVESTIGATE', 'Find friction, loops, and invisible effort.'], ['03', 'INTERVENE', 'Compare changes before you commit.']].map(([number, title, copy]) => <div className="process-step" key={number}><span>{number}</span><strong>{title}</strong><p>{copy}</p></div>)}</div>
      </section>
      <footer className="landing-footer"><span>© BlindSpot INTELLIGENCE SYSTEMS</span><span>DEMONSTRATION ENVIRONMENT <i /></span></footer>
    </main>
  )
}

function SetupView({ scenario, fileName, uploadEvents, mappings, error, busy, dragging, fileInput, onFile, onScenario, onSample, onAnalyze, onBack, onPick, onDrag }: {
  scenario: Scenario; fileName: string | null; uploadEvents: EventRecord[] | null; mappings: string[]; error: string; busy: boolean; dragging: boolean
  fileInput: React.RefObject<HTMLInputElement | null>; onFile: (file?: File) => void; onScenario: (id: Scenario) => void
  onSample: () => void; onAnalyze: () => void; onBack: () => void; onPick: () => void; onDrag: (dragging: boolean) => void
}) {
  const stats = useMemo(() => uploadEvents ? analyzeEvents(uploadEvents, 'upload').stats : null, [uploadEvents])
  return (
    <div className="setup-view">
      <div className="eyebrow"><i /> NEW INVESTIGATION / DATA SOURCE</div><button className="back-link" onClick={onBack}>← Back to workspace</button>
      <div className="setup-heading"><h1>Start with the evidence.</h1><p>Choose a synthetic workflow or inspect event records. All CSV analysis happens locally in this browser.</p></div>
      <div className="setup-grid">
        <section className="setup-main">
          <div className="section-overline"><span>01</span> SELECT AN INVESTIGATION</div>
          <div className="scenario-picker">{scenarios.map((item) => <button key={item.id} onClick={() => onScenario(item.id)} className={`scenario-option ${scenario === item.id ? 'selected' : ''}`}><span className="scenario-icon">{item.id === 'support' ? <Users size={16} /> : item.id === 'finance' ? <BarChart3 size={16} /> : <Building2 size={16} />}</span><span className="scenario-text"><strong>{item.name}</strong><small>{item.detail}</small></span>{scenario === item.id && <span className="scenario-check"><Check size={13} /></span>}</button>)}</div>
          <div className="section-overline setup-data-label"><span>02</span> CHOOSE YOUR DATA</div>
          <div className="source-options">
            <div className="sample-source"><span className="source-icon"><Database size={16} /></span><div className="source-content"><strong>Use synthetic sample</strong><p>Hundreds of reproducible event records with planted, detectable patterns.</p><button className="outline-button" onClick={onSample}>LOAD {scenarios.find((item) => item.id === scenario)?.name.toUpperCase()} SAMPLE <ArrowRight size={12} /></button></div><span className="synthetic-stamp">SYNTHETIC</span></div>
            <div className="upload-source">
              <div className="source-title"><span className="source-icon"><Upload size={16} /></span><div><strong>Upload a CSV</strong><p>Files are parsed and analyzed on your device only.</p></div></div>
              <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} />
              <button className={`drop-zone ${dragging ? 'drag-active' : ''}`} onClick={onPick} onDragEnter={(event) => { event.preventDefault(); onDrag(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => onDrag(false)} onDrop={(event) => { event.preventDefault(); onDrag(false); onFile(event.dataTransfer.files?.[0]) }}>
                {busy ? <span className="upload-loader" /> : <Upload size={18} />}<strong>{busy ? 'Reading your file…' : fileName ?? 'Drop a CSV here or browse files'}</strong><span>Required: case + action · Optional: timestamp, employee, department, system, status, duration</span><small>MAX 20 MB · .CSV ONLY</small>
              </button>
              {error && <div className="upload-error" role="alert"><X size={13} />{error}</div>}
              {uploadEvents && stats && <div className="upload-preview">
                <div className="preview-success"><Check size={14} /><strong>{stats.rows.toLocaleString()} usable records detected</strong><span>{mappings.length ? 'COLUMN MAPPINGS APPLIED' : 'CANONICAL HEADERS'}</span></div>
                {mappings.length > 0 && <div className="mapping-list">{mappings.map((mapping) => <span key={mapping}>{mapping}</span>)}</div>}
                <div className="preview-stats">{[['CASES', stats.cases], ['EMPLOYEES', stats.employees], ['SYSTEMS', stats.systems], ['DEPARTMENTS', stats.departments]].map(([label, number]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div>
                <div className="preview-range">TIME RANGE <b>{dateLabel(stats.start)} — {dateLabel(stats.end)}</b>{stats.avgDuration !== undefined && <span>AVG DURATION <b>{stats.avgDuration.toFixed(1)} min</b></span>}</div>
                <div className="table-wrap"><table><thead><tr><th>CASE</th><th>ACTIVITY</th><th>SYSTEM</th><th>OWNER</th><th>DURATION</th></tr></thead><tbody>{uploadEvents.slice(0, 5).map((event, index) => <tr key={`${event.caseId}-${index}`}><td>{event.caseId}</td><td>{event.action}</td><td>{event.system ?? '—'}</td><td>{event.employeeId ?? '—'}</td><td>{event.durationMinutes === undefined ? '—' : `${event.durationMinutes}m`}</td></tr>)}</tbody></table></div>
                <button className="primary-button analyze-upload" onClick={onAnalyze}><ScanLine size={14} /> ANALYZE {stats.rows.toLocaleString()} RECORDS <ArrowRight size={13} /></button>
              </div>}
            </div>
          </div>
          <p className="privacy-note"><ShieldCheck size={13} /> No CSV content is sent to an external service. Metrics come directly from uploaded records.</p>
        </section>
        <aside className="setup-aside"><div className="aside-orbit"><div /><div /><ScanLine size={19} /></div><div className="aside-label">THE BlindSpot PIPELINE</div><h3>From raw events<br />to informed action.</h3><div className="pipeline-steps">{[['01', 'Normalize', 'Map fields to a shared event model'], ['02', 'Reconstruct', 'Order observed actions by case'], ['03', 'Detect', 'Find repeat, wait, and switch patterns'], ['04', 'Recommend', 'Explain evidence-linked options'], ['05', 'Simulate', 'Explore editable assumptions']].map(([number, title, copy]) => <div className="pipeline-step" key={number}><span>{number}</span><div><strong>{title}</strong><small>{copy}</small></div><Check size={11} /></div>)}</div><div className="aside-foot"><ShieldCheck size={12} /> DETERMINISTIC · REPRODUCIBLE · TRANSPARENT</div></aside>
      </div>
    </div>
  )
}

function EmptyWorkspace({ onStart }: { onStart: () => void }) {
  return <div className="empty-workspace"><div className="empty-mark"><Workflow size={23} /></div><span>NO ACTIVE INVESTIGATION</span><h2>Start with a workflow.</h2><p>Select a synthetic investigation or upload event records to surface the work your systems never captured.</p><button className="primary-button" onClick={onStart}>CHOOSE A DATA SOURCE <ArrowRight size={14} /></button></div>
}

function Kpi({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail: string; tone: string }) {
  return <div className={`kpi-card kpi-${tone}`}><div className="kpi-label"><Icon size={13} />{label}<ArrowRight size={12} /></div><strong>{value}</strong><span>{detail}</span><div className="kpi-rule"><i /></div></div>
}

function Overview({ analysis, sourceName, synthetic, onNavigate, onTrace, onNode, timelineCount, onTimeline, onReplay }: {
  analysis: Analysis; sourceName: string; synthetic: boolean; onNavigate: (view: Screen) => void; onTrace: (finding: Discovery) => void
  onNode: (action: string) => void; timelineCount: number; onTimeline: (count: number) => void; onReplay: () => void
}) {
  const top = analysis.discoveries[0]
  const stages = ['Workflow reconstructed', 'Repeated pattern detected', 'Evidence inspected', 'Root-cause hypothesis', 'Intervention evaluated', 'Impact scenario simulated']
  const nodes = observedNodes(analysis).slice(0, 6)
  return (
    <div className="view-content">
      <div className="kpi-row"><Kpi icon={Workflow} label="EVENT RECORDS" value={analysis.stats.rows.toLocaleString()} detail="normalized observations" tone="cyan" /><Kpi icon={Layers3} label="UNIQUE CASES" value={analysis.stats.cases.toLocaleString()} detail="observed work items" tone="blue" /><Kpi icon={Clock3} label="AVG. EVENT DURATION" value={analysis.stats.avgDuration === undefined ? '—' : `${analysis.stats.avgDuration.toFixed(1)}m`} detail={analysis.stats.avgDuration === undefined ? 'no duration field supplied' : 'calculated from event records'} tone="violet" /><Kpi icon={Search} label="HIDDEN SIGNALS" value={String(analysis.discoveries.length).padStart(2, '0')} detail="calculated patterns" tone="cyan" /></div>
      {synthetic && <div className="demo-notice"><i /><strong>SYNTHETIC DEMONSTRATION DATA</strong><span>{sourceName} · reproducible generated event records</span><span className="notice-right">NOT REAL ORGANIZATIONAL DATA</span></div>}
      <div className="overview-grid">
        <section className="panel workflow-panel"><div className="panel-heading"><div><div className="panel-kicker">OBSERVED PROCESS MAP <span>01 / 03</span></div><h2>Where the work actually goes</h2></div><button className="panel-link" onClick={() => onNavigate('xray')}>OPEN X-RAY <ArrowRight size={11} /></button></div>
          <div className="mini-workflow"><div className="workflow-axis"><span>CASE SEQUENCE · TOP OBSERVED CASE</span><span>{nodes.length} STEPS</span></div><div className="node-track">{nodes.map((node, index) => <div className="node-unit" key={`${node.action}-${index}`}><button className={`workflow-node ${node.signal ? 'node-signal' : ''} ${node.wait ? 'node-wait' : ''}`} onClick={() => onNode(node.action)}><span className="node-index">{String(index + 1).padStart(2, '0')}</span><span className="node-icon">{node.wait ? <Clock3 size={14} /> : node.signal ? <Search size={14} /> : <Layers3 size={14} />}</span><strong>{node.action}</strong><small>{node.systems[0] ?? 'ACTIVITY'}</small><span className="node-frequency">{node.cases} CASES</span></button>{index < nodes.length - 1 && <span className="node-connector"><i /></span>}</div>)}</div><div className="workflow-legend"><span><i className="legend-square expected" />OBSERVED STEP</span><span><i className="legend-square signal" />DETECTED SIGNAL</span><span><i className="legend-square wait" />WAIT / DELAY</span></div></div>
        </section>
        <section className="panel discovery-panel"><div className="panel-heading"><div><div className="panel-kicker">SIGNAL DETECTION <span>02 / 03</span></div><h2>Emerging discoveries</h2></div><button className="panel-link" onClick={() => onNavigate('hidden')}>ALL SIGNALS <ArrowRight size={11} /></button></div>
          {top ? <div className="lead-discovery"><div className="finding-tag"><i />{top.category}</div><h3>{top.name}</h3><p>{top.evidence}</p><div className="finding-metrics"><span><b>{top.cases}</b> cases</span><i /><span><b>{top.percentage}%</b> affected</span><i /><span><b>{top.confidence}</b> signal</span></div><div className="hypothesis-preview"><Lightbulb size={13} /><span><b>HYPOTHESIS</b> {top.hypothesis}</span></div><button className="trace-button" onClick={() => onTrace(top)}>TRACE EVIDENCE <ArrowRight size={12} /></button></div> : <div className="no-findings">No repeated patterns were detected in these records.</div>}
        </section>
      </div>
      <div className="overview-bottom">
        <section className="panel source-panel"><div className="panel-heading"><div><div className="panel-kicker">DATASET PROFILE <span>03 / 03</span></div><h2>Evidence at a glance</h2></div><span className="source-type"><i />{synthetic ? 'SYNTHETIC' : 'LOCAL CSV'}</span></div><div className="source-profile"><span className="source-profile-icon"><FileText size={17} /></span><div className="source-profile-name"><strong>{sourceName}</strong><span>{analysis.stats.rows.toLocaleString()} rows · {analysis.stats.systems} systems · {analysis.stats.departments} departments</span></div><button className="icon-button" aria-label="Open data source" onClick={() => onNavigate('ingest')}><ArrowRight size={14} /></button></div><div className="profile-foot"><span><Clock3 size={11} /> {dateLabel(analysis.stats.start)} — {dateLabel(analysis.stats.end)}</span><button onClick={() => onNavigate('ingest')}>INSPECT RECORDS <ChevronRight size={11} /></button></div></section>
        <section className="panel timeline-panel"><div className="panel-heading"><div><div className="panel-kicker">INVESTIGATION TRACE</div><h2>Analysis timeline</h2></div><button className="icon-button" aria-label="Replay investigation" onClick={onReplay}><RotateCcw size={13} /></button></div><div className="timeline-list">{stages.map((title, index) => { const complete = index < timelineCount; return <button className={`timeline-item ${complete ? 'complete' : ''}`} key={title} onClick={() => onTimeline(index + 1)}><span className="timeline-pin">{complete ? <Check size={9} /> : <i />}</span><span>{title}</span><small>{complete ? 'EVIDENCE' : 'PENDING'}</small></button> })}</div></section>
      </div>
      <div className="view-footnote"><span><ShieldCheck size={11} /> CALCULATED FROM SELECTED RECORDS</span><span>Root causes are hypotheses, not confirmed facts.</span></div>
    </div>
  )
}

function observedNodes(analysis: Analysis) {
  const caseId = analysis.events[0]?.caseId
  const caseEvents = analysis.events.filter((event) => event.caseId === caseId)
  const events = caseEvents.length ? caseEvents : analysis.events.slice(0, 8)
  const seen = new Set<string>()
  return events.filter((event) => { const key = `${event.action.toLowerCase()}-${event.caseId}`; if (seen.has(key)) return false; seen.add(key); return true }).map((event) => {
    const item = analysis.workflow.find((entry) => entry.action.toLowerCase() === event.action.toLowerCase())
    return { action: event.action, systems: item?.systems ?? [], cases: item?.cases ?? 1, signal: analysis.discoveries.some((finding) => finding.actions.some((action) => action.toLowerCase() === event.action.toLowerCase())), wait: /wait|pending|stalled/i.test(`${event.action} ${event.status ?? ''}`) }
  })
}

function Xray({ analysis, scenario, synthetic, mode, setMode, selectedNode, setSelectedNode, activeFinding }: {
  analysis: Analysis; scenario: Scenario; synthetic: boolean; mode: 'observed' | 'official'; setMode: (mode: 'observed' | 'official') => void
  selectedNode: string | null; setSelectedNode: (action: string | null) => void; activeFinding: Discovery | null
}) {
  const actions = mode === 'official' && synthetic ? references[scenario] : observedNodes(analysis).map((node) => node.action)
  const selectedEvents = selectedNode ? analysis.events.filter((event) => event.action.toLowerCase() === selectedNode.toLowerCase()) : []
  const systems = unique(selectedEvents.map((event) => event.system))
  const departments = unique(selectedEvents.map((event) => event.department))
  const cases = new Set(selectedEvents.map((event) => event.caseId)).size
  const minutes = selectedEvents.reduce((sum, event) => sum + (event.durationMinutes ?? 0), 0)
  const linked = analysis.discoveries.filter((finding) => finding.actions.some((action) => action.toLowerCase() === selectedNode?.toLowerCase()))
  return (
    <div className="view-content xray-content">
      <div className="xray-toolbar"><div className="segmented-control" role="group" aria-label="Workflow view">{synthetic && <button className={mode === 'official' ? 'selected' : ''} onClick={() => { setMode('official'); setSelectedNode(null) }}>OFFICIAL WORKFLOW <span>REFERENCE</span></button>}<button className={mode === 'observed' ? 'selected' : ''} onClick={() => { setMode('observed'); setSelectedNode(null) }}>OBSERVED WORKFLOW <span>{analysis.stats.rows} EVENTS</span></button></div><div className="map-controls"><span><i className="legend-square expected" />EXPECTED</span><span><i className="legend-square signal" />ADDITIONAL / SIGNAL</span><button title="Reset selection" aria-label="Reset selection" onClick={() => setSelectedNode(null)}><RotateCcw size={12} /></button></div></div>
      {!synthetic && <div className="reference-note"><CircleHelp size={13} /> No reference workflow was supplied for this CSV. This view shows only the observed event sequence.</div>}
      {activeFinding && <div className="trace-banner"><ScanLine size={14} /><span>TRACING <strong>{activeFinding.name}</strong> · {activeFinding.cases} affected cases</span><span>Evidence-linked steps are highlighted below</span><button onClick={() => setSelectedNode(null)} aria-label="Clear trace"><X size={13} /></button></div>}
      <section className="panel xray-map-panel"><div className="xray-map-head"><div><span>PROCESS RECONSTRUCTION / {mode === 'official' && synthetic ? 'REFERENCE PATH' : 'EVENT-DERIVED PATH'}</span><strong>{mode === 'official' && synthetic ? 'Documented sequence' : 'Most representative observed sequence'}</strong></div><div className="map-meta"><span>{mode === 'official' && synthetic ? 'SAMPLE REFERENCE' : 'RECONSTRUCTED FROM EVENT LOG'}</span><span>CASE {mode === 'official' && synthetic ? 'STANDARD' : analysis.events[0]?.caseId ?? '—'}</span></div></div>
        <div className="xray-canvas"><div className="canvas-grid" /><div className="xray-node-row">{actions.map((action, index) => { const expected = mode === 'official' && synthetic || references[scenario].some((item) => item.toLowerCase() === action.toLowerCase()); const finding = mode === 'observed' ? analysis.discoveries.find((item) => item.actions.some((value) => value.toLowerCase() === action.toLowerCase())) : undefined; const waiting = /wait|pending|stalled/i.test(action); const count = analysis.workflow.find((item) => item.action.toLowerCase() === action.toLowerCase())?.cases ?? 1; return <div className="xray-node-wrap" key={`${action}-${index}`}><button className={`xray-node ${expected ? 'expected-node' : 'observed-extra'} ${finding ? 'signal-node' : ''} ${waiting ? 'waiting-node' : ''} ${selectedNode?.toLowerCase() === action.toLowerCase() ? 'node-selected' : ''} ${activeFinding?.actions.some((value) => value.toLowerCase() === action.toLowerCase()) ? 'node-traced' : ''}`} onClick={() => setSelectedNode(action)}><span className="xray-node-idx">STEP {String(index + 1).padStart(2, '0')}</span><span className="xray-node-icon">{waiting ? <Clock3 size={15} /> : finding ? <Search size={15} /> : <Layers3 size={15} />}</span><strong>{action}</strong><small>{mode === 'official' && synthetic ? 'DOCUMENTED' : `${count} CASES`}</small>{finding && <em>{finding.category}</em>}</button>{index < actions.length - 1 && <div className="xray-connector"><span /><ArrowRight size={12} /></div>}</div> })}</div><div className="canvas-coordinates">SEQUENCE VIEW · SELECT A NODE TO INSPECT SOURCE EVENTS <span>{actions.length} OBSERVED STEPS</span></div></div>
        <div className="xray-legend"><span><i className="legend-square expected" />DOCUMENTED ACTIVITY</span><span><i className="legend-square signal" />EVIDENCE-LINKED SIGNAL</span><span><i className="legend-square wait" />WAIT STATE</span><span><Workflow size={12} />SEQUENCE ORDERED PER CASE</span></div>
      </section>
      <div className="evidence-grid"><section className="panel evidence-panel"><div className="panel-kicker">NODE EVIDENCE <span>01 / SELECTED STEP</span></div>{selectedNode ? <><h2>{selectedNode}</h2><p>Calculated directly from matching event records across the selected dataset.</p><div className="evidence-stat-row"><div><strong>{selectedEvents.length}</strong><span>EVENTS</span></div><div><strong>{cases}</strong><span>CASES</span></div><div><strong>{minutes ? `${Math.round(minutes)}m` : '—'}</strong><span>RECORDED TIME</span></div><div><strong>{systems.length || '—'}</strong><span>SYSTEMS</span></div></div><div className="evidence-pills">{systems.map((system) => <span key={system}><Database size={10} />{system}</span>)}{departments.map((department) => <span key={department}><Users size={10} />{department}</span>)}{!systems.length && !departments.length && <span>Optional dimensions not present in source data</span>}</div>{linked.length > 0 && <div className="linked-findings"><span>LINKED DISCOVERIES</span>{linked.map((finding) => <div key={finding.id}><i />{finding.name}<b>{finding.confidence}</b></div>)}</div>}</> : <div className="evidence-empty"><ScanLine size={18} /><span>SELECT A WORKFLOW NODE TO INSPECT ITS EVIDENCE</span></div>}</section>
        <section className="panel transition-panel"><div className="panel-kicker">OBSERVED TRANSITIONS <span>TOP CASE-TO-CASE EDGES</span></div><h2>Where work moves next</h2><div className="transition-list">{analysis.transitions.slice(0, 5).map((transition, index) => <button key={`${transition.from}-${transition.to}`} className="transition-row" onClick={() => setSelectedNode(transition.from)}><span className="transition-index">0{index + 1}</span><span>{transition.from}</span><ArrowRight size={11} /><strong>{transition.to}</strong><b>{transition.count}×</b></button>)}</div>{analysis.transitions.length === 0 && <p className="quiet-copy">No adjacent transitions could be derived from the available case events.</p>}</section></div>
    </div>
  )
}

function HiddenWork({ analysis, filter, setFilter, onTrace, onIntervention }: { analysis: Analysis; filter: string; setFilter: (value: string) => void; onTrace: (finding: Discovery) => void; onIntervention: (finding: Discovery) => void }) {
  const categories = ['ALL SIGNALS', ...new Set(analysis.discoveries.map((finding) => finding.category))]
  const findings = filter === 'ALL SIGNALS' ? analysis.discoveries : analysis.discoveries.filter((finding) => finding.category === filter)
  return <div className="view-content hidden-content"><div className="hidden-summary panel"><span className="summary-icon"><Search size={17} /></span><div><span>CALCULATED DETECTION SUMMARY</span><strong>{analysis.discoveries.length} signals across {analysis.stats.cases} cases</strong><small>Counts are derived from the selected records. Hypotheses are not confirmed root causes.</small></div><div className="summary-count"><strong>{analysis.stats.rows.toLocaleString()}</strong><span>EVENTS EXAMINED</span></div></div>
    <div className="filter-row"><span>FILTER BY CATEGORY</span><div className="filter-chips">{categories.map((category) => <button key={category} className={filter === category ? 'selected' : ''} onClick={() => setFilter(category)}>{category}</button>)}</div><span className="result-count">{findings.length} FINDINGS</span></div>
    {findings.length ? <div className="discovery-list">{findings.map((finding, index) => <DiscoveryCard key={finding.id} finding={finding} index={index} totalCases={analysis.stats.cases} onTrace={() => onTrace(finding)} onIntervention={() => onIntervention(finding)} />)}</div> : <div className="panel no-results"><Search size={20} /><strong>No pattern detected in this category.</strong><span>This is an evidence-based result, not a placeholder.</span></div>}
    <div className="view-footnote"><span><Lightbulb size={11} /> A HYPOTHESIS IS NOT A CONFIRMED CAUSE</span><span>Time is reported only where duration or timestamps support it.</span></div></div>
}

function DiscoveryCard({ finding, index, totalCases, onTrace, onIntervention }: { finding: Discovery; index: number; totalCases: number; onTrace: () => void; onIntervention: () => void }) {
  return <article className="panel discovery-card"><div className="discovery-number">{String(index + 1).padStart(2, '0')}</div><div className="discovery-card-body"><div className="discovery-meta"><span className="finding-tag"><i />{finding.category}</span><span className={`confidence confidence-${finding.confidence.toLowerCase()}`}>{finding.confidence} EVIDENCE</span></div><h2>{finding.name}</h2><p className="discovery-evidence">{finding.evidence}</p><div className="discovery-metrics"><div><strong>{finding.frequency}</strong><span>OCCURRENCES</span></div><div><strong>{finding.cases}</strong><span>OF {totalCases} CASES</span></div><div><strong>{finding.percentage}%</strong><span>CASE COVERAGE</span></div><div><strong>{finding.timeImpact ? `${Math.round(finding.timeImpact)}m` : '—'}</strong><span>RECORDED MINUTES</span></div></div><div className="discovery-tags">{finding.systems.map((system) => <span key={system}><Database size={10} />{system}</span>)}{finding.departments.map((department) => <span key={department}><Users size={10} />{department}</span>)}</div><div className="root-cause"><Lightbulb size={13} /><div><span>ROOT-CAUSE HYPOTHESIS · NOT CONFIRMED</span><p>{finding.hypothesis}</p></div></div></div><aside className="discovery-card-aside"><span>RECOMMENDED NEXT STEP</span><strong>{finding.intervention}</strong><small>{finding.rationale}</small><button className="trace-button" onClick={onTrace}>TRACE EVIDENCE <ArrowRight size={11} /></button><button className="secondary-action" onClick={onIntervention}>REVIEW INTERVENTION <ChevronRight size={11} /></button></aside></article>
}

function Interventions({ analysis, scenario, selected, onSelect, activeFinding, onTrace, onSimulate }: { analysis: Analysis; scenario: Scenario; selected: InterventionType; onSelect: (type: InterventionType) => void; activeFinding: Discovery | null; onTrace: (finding: Discovery) => void; onSimulate: () => void }) {
  const primary = activeFinding ?? analysis.discoveries[0]
  const recommendation = primary?.intervention ?? 'DO NOTHING'
  const supportReason = 'Employees manually retrieve information across disconnected systems. Automating those manual steps alone may preserve the underlying cause. Integration could remove unnecessary searching while retaining human judgment for customer resolution.'
  const rationale = scenario === 'support' && recommendation === 'INTEGRATE' ? supportReason : primary?.rationale ?? interventionCopy[recommendation].detail
  return <div className="view-content interventions-content"><div className="intervention-callout panel"><span className="recommendation-icon"><BrainCircuit size={19} /></span><div className="recommendation-copy"><span>ENGINE RECOMMENDATION / {activeFinding?.category ?? 'HIGHEST-COVERAGE SIGNAL'}</span><h2>{recommendation} <i>— evidence-led, not automatic</i></h2><p>{rationale}</p></div><div className="recommendation-strength"><span>{primary?.confidence ?? 'EMERGING'}</span><small>evidence strength</small></div></div>
    <div className="intervention-layout"><section className="panel intervention-chooser"><div className="panel-kicker">COMPARE INTERVENTIONS <span>SELECT TO INSPECT</span></div><h2>What kind of change fits?</h2><p className="quiet-copy">Recommendations adapt to evidence; options are not a forced automation path.</p><div className="intervention-options">{interventionTypes.map((type, index) => { const count = analysis.discoveries.filter((finding) => finding.intervention === type).length; return <button className={`intervention-option ${selected === type ? 'chosen' : ''}`} key={type} onClick={() => onSelect(type)}><span className="intervention-option-number">0{index + 1}</span><span className="intervention-option-name">{type}<small>{interventionCopy[type].complexity}</small></span><span className="intervention-evidence-count">{count ? `${count} LINKED` : 'CANDIDATE'}</span><ChevronRight size={13} /></button> })}</div></section>
      <section className="panel intervention-detail"><div className="panel-kicker">DECISION RATIONALE <span>{selected}</span></div><div className="decision-label">SELECTED CANDIDATE</div><h2>{selected}</h2><p>{selected === recommendation ? primary?.rationale ?? rationale : interventionCopy[selected].detail}</p>{selected === recommendation && primary && <div className="supporting-evidence"><span>SUPPORTING EVIDENCE</span><p>{primary.evidence} This is event-derived evidence; it does not establish causality.</p><button onClick={() => onTrace(primary)}>OPEN SOURCE EVENTS <ArrowRight size={11} /></button></div>}<div className="decision-block"><span><ArrowRight size={12} /> EXPECTED BENEFIT</span><p>{selected === recommendation ? primary?.benefit ?? 'Avoid unnecessary work while preserving a baseline.' : interventionCopy[selected].detail}</p></div><div className="decision-block risk-block"><span><ShieldCheck size={12} /> RISKS & LIMITATIONS</span><p>{selected === recommendation ? primary?.risk ?? interventionCopy[selected].risk : interventionCopy[selected].risk}</p></div><div className="human-responsibility"><Users size={13} /><div><span>HUMAN RESPONSIBILITY RETAINED</span><p>{selected === recommendation ? primary?.human ?? interventionCopy[selected].responsibility : interventionCopy[selected].responsibility}</p></div></div><div className="alternatives"><span>ALTERNATIVES & TRADE-OFF</span><p>{selected === recommendation ? primary?.alternatives ?? 'Compare candidate interventions against available evidence.' : `The engine recommends ${recommendation} for this signal. ${selected} may be less appropriate unless process owners validate that its risks are acceptable.`}</p></div><button className="primary-button decision-cta" onClick={onSimulate}>SIMULATE THIS INTERVENTION <ArrowRight size={13} /></button></section></div>
    {analysis.discoveries.length > 1 && <section className="panel finding-link-panel"><div className="panel-kicker">EVIDENCE COVERAGE <span>ALL DETECTED SIGNALS</span></div><div className="finding-link-list">{analysis.discoveries.slice(0, 5).map((finding) => <button key={finding.id} onClick={() => onTrace(finding)}><i />{finding.name}<span>{finding.intervention}</span><b>{finding.cases} CASES</b><ArrowRight size={11} /></button>)}</div></section>}</div>
}

function Simulator({ analysis, scenario, selected, onSelect, simulation, setSimulation, synthetic, onApplied }: { analysis: Analysis; scenario: Scenario; selected: InterventionType; onSelect: (type: InterventionType) => void; simulation: Simulation; setSimulation: (value: Simulation) => void; synthetic: boolean; onApplied: () => void }) {
  const baseline = scenario === 'support' && synthetic ? 31 : Math.round(analysis.stats.avgDuration ?? (scenario === 'finance' ? 27 : 24))
  const safeSavings = Math.min(simulation.savedMinutes, baseline)
  const affectedCases = Math.round(analysis.stats.cases * simulation.affected / 100)
  const future = Math.max(0, baseline - safeSavings)
  const capacityHours = Math.round(safeSavings * affectedCases / 60 * 10) / 10
  const human = selected === 'AUTOMATE' ? 28 : selected === 'INTEGRATE' ? 62 : selected === 'AI-ASSIST' ? 72 : selected === 'REDESIGN' ? 54 : 100
  const apply = () => { setSimulation({ ...simulation, applied: true }); onApplied() }
  return <div className="view-content simulator-content"><div className="assumption-banner"><Sparkles size={14} /><div><strong>SCENARIO ASSUMPTIONS · NOT A PREDICTION</strong><span>{synthetic && scenario === 'support' ? 'Illustrative support scenario: 31m current / 21m after integration.' : 'Future-state estimates are assumptions, separate from calculated current metrics.'}</span></div><span className="assumption-stamp">{synthetic ? 'SYNTHETIC' : 'SIMULATED'}</span></div>
    <div className="simulator-grid"><section className="panel simulator-controls"><div className="panel-kicker">SCENARIO CONFIGURATION <span>LOCAL SIMULATION ONLY</span></div><h2>What if we change this?</h2><p>Adjust assumptions to explore a potential future state. Changes affect this browser session only.</p><label className="control-label" htmlFor="intervention-choice">INTERVENTION TO MODEL</label><div className="select-control"><select id="intervention-choice" value={selected} onChange={(event) => { onSelect(event.target.value as InterventionType); setSimulation({ ...simulation, applied: false }) }}>{interventionTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select><ChevronDown size={13} /></div>
      <div className="range-control"><div className="range-label"><label htmlFor="saving-range">ASSUMED MINUTES SAVED / AFFECTED CASE</label><strong>{safeSavings} <small>min</small></strong></div><input id="saving-range" type="range" min="0" max={Math.min(25, baseline)} value={safeSavings} onChange={(event) => setSimulation({ ...simulation, savedMinutes: Number(event.target.value), applied: false })} /><div className="range-ends"><span>0 min</span><span>{Math.min(25, baseline)} min</span></div></div>
      <div className="range-control"><div className="range-label"><label htmlFor="affected-range">PROPORTION OF CASES AFFECTED</label><strong>{simulation.affected}<small>%</small></strong></div><input id="affected-range" type="range" min="0" max="100" value={simulation.affected} onChange={(event) => setSimulation({ ...simulation, affected: Number(event.target.value), applied: false })} /><div className="range-ends"><span>0%</span><span>100%</span></div></div>
      <div className="assumption-helper"><CircleHelp size={12} /><span>User-controlled assumptions, not measured savings or a validated forecast.</span></div><button className="primary-button apply-scenario" onClick={apply}>{simulation.applied ? <Check size={13} /> : <Zap size={13} />}{simulation.applied ? 'SCENARIO APPLIED LOCALLY' : 'APPLY SCENARIO'} <ArrowRight size={12} /></button>
    </section><section className="panel impact-panel"><div className="panel-heading"><div><div className="panel-kicker">BEFORE / AFTER <span>ESTIMATED SCENARIO</span></div><h2>Handling time per case</h2></div><span className="impact-icon"><BarChart3 size={15} /></span></div>
      <div className="bar-chart"><div className="bar-row"><div className="bar-caption"><span>CURRENT BASELINE</span><strong>{baseline} <small>min</small></strong></div><div className="bar-track"><i className="bar-current" style={{ width: `${Math.max(2, baseline ? 100 : 2)}%` }} /></div><span className="bar-source">{synthetic && scenario === 'support' ? 'SCENARIO ASSUMPTION' : analysis.stats.avgDuration === undefined ? 'ASSUMED BASELINE' : 'EVENT DURATION AVG.'}</span></div><div className="bar-row future-row"><div className="bar-caption"><span>ESTIMATED FUTURE</span><strong>{future} <small>min</small></strong></div><div className="bar-track"><i className="bar-future" style={{ width: `${Math.max(2, future / Math.max(baseline, future, 1) * 100)}%` }} /></div><span className="bar-source">PROJECTED · NOT MEASURED</span></div><div className="saving-indicator"><span><ArrowDownRight size={15} /> {safeSavings} MINUTES / AFFECTED CASE</span><span>{baseline ? Math.round(safeSavings / baseline * 100) : 0}% LESS ASSUMED HANDLING TIME</span></div></div>
      <div className="impact-metrics"><div><span>CASES AFFECTED</span><strong>{affectedCases.toLocaleString()} <small>of {analysis.stats.cases.toLocaleString()}</small></strong><i className="mini-track"><b style={{ width: `${simulation.affected}%` }} /></i></div><div><span>CAPACITY RECOVERED</span><strong>{capacityHours} <small>hours / observed cases</small></strong><span className="metric-note">{safeSavings}m × {affectedCases} cases ÷ 60</span></div></div>
      <div className="impact-meta"><div><span>HUMAN INVOLVEMENT RETAINED</span><strong>{human}%</strong><i className="mini-track"><b style={{ width: `${human}%` }} /></i></div><div><span>IMPLEMENTATION COMPLEXITY</span><strong className="complexity-label">{interventionCopy[selected].complexity}</strong></div><div><span>RISK & UNCERTAINTY</span><strong className="risk-label">{interventionCopy[selected].risk}</strong></div></div>
      <div className="sim-explanation"><Lightbulb size={13} /><span><b>CALCULATION</b> Assumed minutes saved × cases affected ÷ 60 = illustrative capacity hours. Actual outcomes depend on adoption, quality, exception volume, and baseline accuracy.</span></div>
    </section></div><div className="sim-footnote"><span><ShieldCheck size={12} /> APPLY SCENARIO ONLY UPDATES THIS LOCAL SIMULATION</span><span>Evidence, assumptions, and projections are labeled separately.</span></div></div>
}

