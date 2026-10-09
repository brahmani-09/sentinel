'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, BrainCircuit, Building2,
  Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Command, Database, Download, FileText,
  GitBranch, GitMerge, Layers3, Lightbulb, Menu, Network, Play, RotateCcw, ScanLine, Search,
  ShieldCheck, Sparkles, Upload, Users, Workflow, X, Zap,
} from 'lucide-react'
import {
  analyzeEvents, createSampleEvents, parseCsv,
  type Analysis, type Discovery, type EventRecord, type InterventionType, type ScenarioId,
} from './sentinel/engine'

type View = 'overview' | 'xray' | 'hidden' | 'interventions' | 'simulator' | 'ingest'
type Scenario = Exclude<ScenarioId, 'upload'>
const scenarios: { id: Scenario; name: string; short: string; descriptor: string; icon: typeof Users }[] = [
  { id: 'support', name: 'Customer support', short: 'SUPPORT OPERATIONS', descriptor: 'Cross-system search · response delays · handoffs', icon: Users },
  { id: 'finance', name: 'Finance operations', short: 'FINANCE OPERATIONS', descriptor: 'Reconciliation · duplicate entry · exceptions', icon: BarChart3 },
  { id: 'hr', name: 'Human resources', short: 'PEOPLE OPERATIONS', descriptor: 'Approval loops · stalled handoffs · ownership', icon: Building2 },
]
const navItems: { id: View; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'xray', label: 'Workflow X-Ray', icon: ScanLine },
  { id: 'hidden', label: 'Hidden work', icon: Search },
  { id: 'interventions', label: 'Intervention engine', icon: GitMerge },
  { id: 'simulator', label: 'Impact simulator', icon: BarChart3 },
]
const phases = ['Reconstructing workflows', 'Examining repeated activities', 'Comparing system transitions', 'Investigating bottlenecks', 'Evaluating interventions']
const interventionTypes: InterventionType[] = ['INTEGRATE', 'AI-ASSIST', 'AUTOMATE', 'HUMAN', 'REDESIGN', 'DO NOTHING']
const interventionCopy: Record<InterventionType, { detail: string; responsibility: string; complexity: string }> = {
  INTEGRATE: { detail: 'Connect information flows at the source instead of automating a manual workaround.', responsibility: 'People retain judgment for customer outcomes and exceptions.', complexity: 'HIGH · systems and access review' },
  'AI-ASSIST': { detail: 'Retrieve, summarize, or prepare context for a person to verify and act on.', responsibility: 'A human reviews generated context and owns the final decision.', complexity: 'MEDIUM · quality and review design' },
  AUTOMATE: { detail: 'Use deterministic rules for stable, repeatable work with explicit exception routing.', responsibility: 'People review exceptions and remain accountable for outcomes.', complexity: 'MEDIUM · rule and exception design' },
  HUMAN: { detail: 'Keep this activity with an accountable person where context or nuanced judgment matters.', responsibility: 'A clearly named owner makes and documents the decision.', complexity: 'LOW · clarify decision ownership' },
  REDESIGN: { detail: 'Simplify the workflow, clarify ownership, or remove steps before adding technology.', responsibility: 'Process owners validate control coverage and approve changed paths.', complexity: 'MEDIUM · stakeholder and policy review' },
  'DO NOTHING': { detail: 'Keep the current process until the evidence supports a proportionate change.', responsibility: 'Monitor outcomes and revisit if better evidence becomes available.', complexity: 'LOW · retain a baseline' },
}
const supportOfficial = ['Open ticket', 'Check customer', 'Resolve ticket']
const scenarioOfficial: Record<Scenario, string[]> = {
  support: supportOfficial,
  finance: ['Open batch', 'Match records', 'Review exceptions', 'Close batch'],
  hr: ['Open request', 'Review request', 'Approve request'],
}

function formatDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not available'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
function percent(value: number) { return `${Math.round(value)}%` }

export default function Home() {
  const [view, setView] = useState<View | 'welcome' | 'setup'>('welcome')
  const [scenario, setScenario] = useState<Scenario>('support')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [isSynthetic, setIsSynthetic] = useState(true)
  const [sourceName, setSourceName] = useState('Support operations · 84 cases')
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [workflowMode, setWorkflowMode] = useState<'observed' | 'official'>('observed')
  const [discoveryFilter, setDiscoveryFilter] = useState('ALL SIGNALS')
  const [selectedIntervention, setSelectedIntervention] = useState<InterventionType>('INTEGRATE')
  const [simulation, setSimulation] = useState({ savedMinutes: 10, affected: 68, applied: false })
  const [phase, setPhase] = useState(-1)
  const [timelineCount, setTimelineCount] = useState(2)
  const [activeFinding, setActiveFinding] = useState<Discovery | null>(null)
  const [csvError, setCsvError] = useState('')
  const [csvMappings, setCsvMappings] = useState<string[]>([])
  const [csvFile, setCsvFile] = useState<string | null>(null)
  const [uploadEvents, setUploadEvents] = useState<EventRecord[] | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (phase < 0) return
    const timer = window.setInterval(() => setPhase((current) => {
      if (current >= phases.length - 1) { window.clearInterval(timer); return -1 }
      return current + 1
    }), 420)
    return () => window.clearInterval(timer)
  }, [phase])

  const startSample = (id: Scenario) => {
    const sample = createSampleEvents(id)
    setScenario(id)
    setAnalysis(analyzeEvents(sample, id))
    setSourceName(`${scenarios.find((item) => item.id === id)?.name} · ${new Set(sample.map((event) => event.caseId)).size} cases`)
    setIsSynthetic(true)
    setUploadEvents(null)
    setCsvFile(null)
    setCsvError('')
    setSelectedNode(null)
    setWorkflowMode('observed')
    setTimelineCount(2)
    setPhase(0)
    setView('overview')
    setSimulation({ savedMinutes: id === 'support' ? 10 : 8, affected: 68, applied: false })
    setSelectedIntervention(id === 'support' ? 'INTEGRATE' : id === 'finance' ? 'AUTOMATE' : 'REDESIGN')
  }

  const selectScenario = (id: Scenario) => {
    setScenario(id)
    setUploadEvents(null)
    setCsvFile(null)
    setCsvError('')
    setAnalysis(null)
    setView('setup')
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    setCsvError('')
    setCsvMappings([])
    setUploadEvents(null)
    setCsvFile(file.name)
    if (!file.name.toLowerCase().endsWith('.csv')) { setCsvError('Choose a .csv file. The file is parsed locally and is never sent to an external service.'); return }
    try {
      const parsed = parseCsv(await file.text())
      setUploadEvents(parsed.events)
      setCsvMappings(parsed.mappings)
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'The CSV could not be read. Check its headers and try again.')
    }
  }

  const analyzeUpload = () => {
    if (!uploadEvents) return
    const result = analyzeEvents(uploadEvents, 'upload')
    setAnalysis(result)
    setIsSynthetic(false)
    setSourceName(csvFile ?? 'Uploaded CSV')
    setScenario('support')
    setTimelineCount(2)
    setPhase(0)
    setView('overview')
    const top = result.discoveries[0]
    setSelectedIntervention(top?.intervention ?? 'DO NOTHING')
    setSimulation({ savedMinutes: Math.min(20, Math.round(result.stats.avgDuration ? result.stats.avgDuration * 0.25 : 8)), affected: top?.percentage ?? 50, applied: false })
  }

  const openTrace = (finding: Discovery) => {
    setActiveFinding(finding)
    setSelectedNode(finding.actions[0] ?? null)
    setView('xray')
  }

  const resetToWelcome = () => {
    setAnalysis(null)
    setView('welcome')
    setPhase(-1)
    setTimelineCount(0)
  }

  if (view === 'welcome') return <Landing onStart={() => setView('setup')} onExplore={() => startSample('support')} />

  return (
    <main className="sentinel-app">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="topbar">
        <button className="brand-lockup" onClick={resetToWelcome} aria-label="SENTINEL home">
          <span className="brand-mark"><ScanLine size={19} strokeWidth={1.7} /></span>
          <span className="brand-wordmark">SENTINEL<span>INVISIBLE WORK INTELLIGENCE</span></span>
        </button>
        <div className="topbar-context">
          <span className="context-label">ACTIVE INVESTIGATION</span>
          <div className="investigation-select-wrap">
            <select aria-label="Select investigation" value={scenario} onChange={(event) => selectScenario(event.target.value as Scenario)}>
              {scenarios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select><ChevronDown size={14} />
          </div>
          <span className="topbar-divider" />
          <span className="period-label">{analysis?.stats.start ? `${formatDate(analysis.stats.start)} — ${formatDate(analysis.stats.end)}` : 'Select a data source'}</span>
        </div>
        <div className="topbar-actions">
          <span className={`data-badge ${isSynthetic ? 'demo' : 'uploaded'}`}><span />{isSynthetic ? 'DEMO DATA' : 'LOCAL CSV'}</span>
          <button className="icon-button notification-button" aria-label="System status: all systems operational" title="System status: all systems operational"><Bell size={17} /><i /></button>
          <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={19} /></button>
          <div className="avatar-mark">S</div>
        </div>
      </header>

      <div className="app-frame">
        <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <div className="sidebar-label">INVESTIGATION</div>
          <nav className="primary-nav" aria-label="Investigation modules">
            {navItems.map(({ id, label, icon: Icon }, index) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setView(id); setMobileNav(false) }}>
              <Icon size={17} strokeWidth={1.75} /><span>{label}</span>{id === 'hidden' && analysis && <span className="nav-count">{analysis.discoveries.length}</span>}{view === id && <span className="nav-active-indicator" />}{index === 3 && <span className="nav-divider" />}
            </button>)}
          </nav>
          <div className="sidebar-bottom">
            <div className="pipeline-card">
              <div className="pipeline-head"><span className="pipeline-dot" />ENGINE STATUS</div>
              <strong>{analysis ? 'Analysis ready' : 'Awaiting data'}</strong>
              <span>LOCAL · RULE-BASED · TRACEABLE</span>
              <div className="pipeline-line"><i style={{ width: analysis ? '100%' : '9%' }} /></div>
            </div>
            <button className="sidebar-link" onClick={() => { setView('setup'); setMobileNav(false) }}><Database size={15} /> Data sources <ArrowRight size={13} /></button>
            <button className="sidebar-link" onClick={() => { setToast('All calculations run locally in your browser. No external AI or API is connected.'); window.setTimeout(() => setToast(''), 3800) }}><CircleHelp size={15} /> About this engine <ArrowRight size={13} /></button>
            <div className="sidebar-foot"><ShieldCheck size={13} /> PRIVATE BY DESIGN <span>v0.9.4</span></div>
          </div>
        </aside>

        <section className="workspace">
          {view === 'setup' ? <SetupView scenario={scenario} fileName={csvFile} uploadEvents={uploadEvents} mappings={csvMappings} error={csvError} fileInput={fileInput} onFile={handleFile} onDrop={(file) => handleFile(file)} onPick={() => fileInput.current?.click()} onScenario={selectScenario} onSample={() => startSample(scenario)} onAnalyze={analyzeUpload} onBack={() => analysis ? setView('overview') : setView('welcome')} /> : !analysis ? <EmptyWorkspace onStart={() => setView('setup')} /> : <>
            <div className="workspace-head">
              <div><div className="eyebrow"><span className="eyebrow-line" /> OPERATIONAL INTELLIGENCE / {navItems.find((item) => item.id === view)?.label.toUpperCase()}</div>
                <h1>{view === 'overview' ? 'The work behind the work.' : view === 'xray' ? 'See the work systems miss.' : view === 'hidden' ? 'Invisible work, in evidence.' : view === 'interventions' ? 'Change the cause, not the workaround.' : 'Model the operational upside.'}</h1>
                <p className="page-subtitle">{view === 'overview' ? 'A living reconstruction of how work moves across your organization.' : view === 'xray' ? 'Compare the documented path with the observed sequence of events.' : view === 'hidden' ? 'Signals are calculated from the selected event records. Root causes remain hypotheses.' : view === 'interventions' ? 'Every recommendation is evidence-linked, reasoned, and open to comparison.' : 'Explore scenario assumptions before committing to an operational change.'}</p>
              </div>
              <div className="workspace-head-actions"><button className="quiet-button" onClick={() => { setTimelineCount(2); setPhase(0); setToast('Investigation replay started.'); window.setTimeout(() => setToast(''), 2200) }}><RotateCcw size={14} /> Replay analysis</button><button className="primary-button compact" onClick={() => setView('setup')}><Database size={14} /> Change data</button></div>
            </div>
            {phase >= 0 && <div className="analysis-ribbon"><span className="analysis-spinner"><ScanLine size={14} /></span><strong>{phases[Math.max(0, phase)]}</strong><div className="phase-track">{phases.map((_, index) => <i key={index} className={index <= phase ? 'filled' : ''} />)}</div><span>{phase + 1} / {phases.length}</span></div>}
            {view === 'overview' && <Overview analysis={analysis} sourceName={sourceName} synthetic={isSynthetic} onNavigate={setView} onTrace={openTrace} onSelectNode={setSelectedNode} phase={phase} timelineCount={timelineCount} onTimeline={(count) => setTimelineCount(count)} onReplay={() => { setPhase(0); setTimelineCount(2) }} />}
            {view === 'xray' && <Xray analysis={analysis} scenario={scenario} mode={workflowMode} setMode={setWorkflowMode} selectedNode={selectedNode} setSelectedNode={setSelectedNode} activeFinding={activeFinding} />}
            {view === 'hidden' && <HiddenWork analysis={analysis} filter={discoveryFilter} setFilter={setDiscoveryFilter} onTrace={openTrace} onIntervention={(finding) => { setActiveFinding(finding); setSelectedIntervention(finding.intervention); setView('interventions') }} />}
            {view === 'interventions' && <Interventions analysis={analysis} scenario={scenario} selected={selectedIntervention} onSelect={setSelectedIntervention} activeFinding={activeFinding} onTrace={openTrace} onSimulate={() => setView('simulator')} />}
            {view === 'simulator' && <Simulator analysis={analysis} scenario={scenario} selected={selectedIntervention} onSelect={setSelectedIntervention} simulation={simulation} setSimulation={setSimulation} synthetic={isSynthetic} />}
          </>}
        </section>
      </div>
      {toast && <div className="toast-message" role="status"><Check size={15} />{toast}</div>}
    </main>
  )
}

function Landing({ onStart, onExplore }: { onStart: () => void; onExplore: () => void }) {
  return <main className="landing-shell"><div className="landing-grid" aria-hidden="true" /><div className="landing-glow" aria-hidden="true" />
    <header className="landing-header"><a className="brand-lockup" href="#top"><span className="brand-mark"><ScanLine size={19} /></span><span className="brand-wordmark">SENTINEL<span>INVISIBLE WORK INTELLIGENCE</span></span></a><div className="landing-status"><span className="status-live" /> INTELLIGENCE ENGINE <span className="landing-status-sep">/</span> READY</div><a className="landing-top-link" href="#method">THE METHOD <ArrowDownRight size={14} /></a></header>
    <section className="landing-hero" id="top"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-rule" /> WORKFLOW INVESTIGATION SYSTEM <span className="kicker-index">SYS / 01</span></div><h1>Your organization<br />has a <span>hidden</span><br />operating system.</h1><p>Discover the work your systems never recorded, understand why it exists, and simulate what should change before making a decision.</p><div className="hero-actions"><button className="primary-button hero-cta" onClick={onStart}>INITIATE INVESTIGATION <ArrowRight size={16} /></button><button className="text-button" onClick={onExplore}><Play size={13} /> EXPLORE SAMPLE INVESTIGATION</button></div><div className="hero-assurance"><ShieldCheck size={14} /><span>LOCAL ANALYSIS</span><i /> <span>NO API KEY REQUIRED</span><i /> <span>TRACEABLE EVIDENCE</span></div></div>
      <HeroVisual />
    </section>
    <section className="landing-bottom" id="method"><div className="landing-bottom-label">ONE ENGINE. EVERY WORKFLOW.</div><div className="landing-principle">"Don't automate the workaround.<br /><span>Discover and fix the reason it exists.</span>"</div><div className="landing-process">{[['01', 'RECONSTRUCT', 'Turn event data into the work as it happens.'], ['02', 'INVESTIGATE', 'Find friction, loops, and invisible effort.'], ['03', 'INTERVENE', 'Compare changes before you commit.']].map(([num, title, copy]) => <div className="process-step" key={num}><span>{num}</span><strong>{title}</strong><p>{copy}</p></div>)}</div></section>
    <footer className="landing-footer"><span>© SENTINEL INTELLIGENCE SYSTEMS</span><span>DEMONSTRATION ENVIRONMENT <i /></span></footer>
  </main>
}

function HeroVisual() {
  const nodes = [{ x: 24, y: 49, label: 'CRM', type: 'base' }, { x: 46, y: 25, label: 'LOOKUP', type: 'signal' }, { x: 70, y: 49, label: 'WAIT', type: 'alert' }, { x: 46, y: 75, label: 'EMAIL', type: 'signal' }, { x: 88, y: 49, label: 'RESOLVE', type: 'base' }]
  return <div className="hero-visual"><div className="visual-topline"><span><span className="visual-pulse" /> LIVE WORKFLOW TRACE</span><span>CASE / 01842</span></div><div className="hero-map"><div className="map-grid" /><svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M24 49 L46 25 L70 49 L88 49 M24 49 L46 75 L70 49" /><path className="path-active" d="M24 49 L46 25 L70 49 L88 49" /><path className="path-dash" d="M24 49 L46 75 L70 49" /></svg>{nodes.map((node) => <div key={node.label} className={`hero-node hero-node-${node.type}`} style={{ left: `${node.x}%`, top: `${node.y}%` }}><span>{node.type === 'alert' ? <Clock3 size={13} /> : node.type === 'signal' ? <Search size={13} /> : <Layers3 size={13} />}</span><b>{node.label}</b></div>)}<div className="scan-beam" /><div className="map-coord coord-one">37°46' N / 122°25' W</div><div className="map-coord coord-two">OBSERVED / 07 STEPS</div></div><div className="visual-foot"><span><i className="legend-dot cyan" /> RECORDED ACTIVITY</span><span><i className="legend-dot violet" /> INVISIBLE WORK</span><span>CONFIDENCE <b>0.87</b></span></div><div className="hero-callout"><div className="callout-icon"><Sparkles size={15} /></div><div><span>UNEXPECTED PATTERN</span><strong>3 unrecorded transitions surfaced</strong></div><ChevronRight size={15} /></div></div>
}

function SetupView({ scenario, fileName, uploadEvents, mappings, error, fileInput, onFile, onDrop, onPick, onScenario, onSample, onAnalyze, onBack }: { scenario: Scenario; fileName: string | null; uploadEvents: EventRecord[] | null; mappings: string[]; error: string; fileInput: React.RefObject<HTMLInputElement | null>; onFile: (file?: File) => void; onDrop: (file?: File) => void; onPick: () => void; onScenario: (id: Scenario) => void; onSample: () => void; onAnalyze: () => void; onBack: () => void }) {
  const stats = uploadEvents ? analyzeEvents(uploadEvents, 'upload').stats : null
  return <div className="setup-view"><div className="eyebrow"><span className="eyebrow-line" /> NEW INVESTIGATION / DATA SOURCE</div><button className="back-link" onClick={onBack}>← Back to workspace</button><div className="setup-heading"><h1>Start with the evidence.</h1><p>Choose a synthetic workflow or inspect your own event records. All CSV analysis happens locally in this browser.</p></div>
    <div className="setup-grid"><section className="setup-main"><div className="section-overline"><span>01</span> SELECT AN INVESTIGATION</div><div className="scenario-picker">{scenarios.map((item) => { const Icon = item.icon; return <button onClick={() => onScenario(item.id)} className={`scenario-option ${scenario === item.id ? 'selected' : ''}`} key={item.id}><span className="scenario-icon"><Icon size={17} /></span><span className="scenario-text"><strong>{item.name}</strong><small>{item.descriptor}</small></span>{scenario === item.id && <span className="scenario-check"><Check size={14} /></span>}</button> })}</div>
      <div className="section-overline setup-data-label"><span>02</span> CHOOSE YOUR DATA</div><div className="source-options"><div className="sample-source"><div className="source-icon"><Database size={17} /></div><div className="source-content"><strong>Use synthetic sample</strong><p>Hundreds of reproducible event records with planted, detectable patterns.</p><button className="outline-button" onClick={onSample}>LOAD {scenarios.find((item) => item.id === scenario)?.short} SAMPLE <ArrowRight size={13} /></button></div><span className="synthetic-stamp">SYNTHETIC</span></div>
        <div className="upload-source"><div className="source-title"><span className="source-icon"><Upload size={17} /></span><div><strong>Upload a CSV</strong><p>Files are parsed and analyzed on your device only.</p></div></div><input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /><button className="drop-zone" onClick={onPick} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(event.dataTransfer.files?.[0]) }}><Upload size={19} /><strong>{fileName ?? 'Drop a CSV here or browse files'}</strong><span>Required columns: case + action · Optional: timestamp, employee, department, system, status, duration</span><small>MAX 20 MB · .CSV ONLY</small></button>{error && <div className="upload-error" role="alert"><X size={14} />{error}</div>}
          {uploadEvents && stats && <div className="upload-preview"><div className="preview-success"><Check size={15} /><strong>{stats.rows.toLocaleString()} usable records detected</strong><span>{mappings.length ? 'COLUMN MAPPINGS APPLIED' : 'CANONICAL HEADERS'}</span></div>{mappings.length > 0 && <div className="mapping-list">{mappings.map((mapping) => <span key={mapping}>{mapping}</span>)}</div>}<div className="preview-stats">{[['CASES', stats.cases], ['EMPLOYEES', stats.employees], ['SYSTEMS', stats.systems], ['DEPARTMENTS', stats.departments]].map(([label, number]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div><div className="preview-range">TIME RANGE <b>{formatDate(stats.start)} — {formatDate(stats.end)}</b>{stats.avgDuration !== undefined && <span>AVG DURATION <b>{stats.avgDuration.toFixed(1)} min</b></span>}</div><div className="table-wrap"><table><thead><tr><th>CASE</th><th>ACTIVITY</th><th>SYSTEM</th><th>OWNER</th><th>DURATION</th></tr></thead><tbody>{uploadEvents.slice(0, 5).map((event, index) => <tr key={`${event.caseId}-${index}`}><td>{event.caseId}</td><td>{event.action}</td><td>{event.system ?? '—'}</td><td>{event.employeeId ?? '—'}</td><td>{event.durationMinutes === undefined ? '—' : `${event.durationMinutes}m`}</td></tr>)}</tbody></table></div><button className="primary-button analyze-upload" onClick={onAnalyze}><ScanLine size={15} /> ANALYZE {stats.rows.toLocaleString()} RECORDS <ArrowRight size={14} /></button></div>}
        </div></div>
      <p className="privacy-note"><ShieldCheck size={14} /> No CSV content is sent to an external service. Metrics come directly from the uploaded records.</p>
    </section><aside className="setup-aside"><div className="aside-orbit"><div /><div /><ScanLine size={21} /></div><div className="aside-label">THE SENTINEL PIPELINE</div><h3>From raw events<br />to informed action.</h3><div className="pipeline-steps">{[['01', 'Normalize', 'Map fields to a shared event model'], ['02', 'Reconstruct', 'Order observed actions by case'], ['03', 'Detect', 'Find repeat, wait, and switch patterns'], ['04', 'Recommend', 'Explain evidence-linked options'], ['05', 'Simulate', 'Explore editable assumptions']].map(([number, title, copy]) => <div className="pipeline-step" key={number}><span>{number}</span><div><strong>{title}</strong><small>{copy}</small></div><Check size={12} /></div>)}</div><div className="aside-foot"><ShieldCheck size={13} /> DETERMINISTIC · REPRODUCIBLE · TRANSPARENT</div></aside></div>
  </div>
}

function EmptyWorkspace({ onStart }: { onStart: () => void }) { return <div className="empty-workspace"><div className="empty-mark"><Workflow size={24} /></div><span>NO ACTIVE INVESTIGATION</span><h2>Start with a workflow.</h2><p>Select a synthetic investigation or upload event records to surface the work your systems never captured.</p><button className="primary-button" onClick={onStart}>CHOOSE A DATA SOURCE <ArrowRight size={15} /></button></div> }

function Overview({ analysis, sourceName, synthetic, onNavigate, onTrace, onSelectNode, phase, timelineCount, onTimeline, onReplay }: { analysis: Analysis; sourceName: string; synthetic: boolean; onNavigate: (view: View) => void; onTrace: (finding: Discovery) => void; onSelectNode: (action: string) => void; phase: number; timelineCount: number; onTimeline: (count: number) => void; onReplay: () => void }) {
  const top = analysis.discoveries[0]
  const currentTime = analysis.stats.avgDuration !== undefined ? `${analysis.stats.avgDuration.toFixed(1)}m` : '—'
  const stages = ['Workflow reconstructed', 'Repeated pattern detected', 'Evidence inspected', 'Root-cause hypothesis', 'Intervention evaluated', 'Impact scenario simulated']
  return <div className="view-content"><div className="kpi-row"><Kpi icon={Workflow} label="EVENT RECORDS" value={analysis.stats.rows.toLocaleString()} detail="normalized observations" color="cyan" /><Kpi icon={Layers3} label="UNIQUE CASES" value={analysis.stats.cases.toLocaleString()} detail="observed work items" color="blue" /><Kpi icon={Clock3} label="AVG. EVENT DURATION" value={currentTime} detail={analysis.stats.avgDuration === undefined ? 'no duration field supplied' : 'calculated from event records'} color="violet" /><Kpi icon={Search} label="HIDDEN SIGNALS" value={analysis.discoveries.length.toString().padStart(2, '0')} detail="calculated patterns" color="cyan" /></div>
    {synthetic && <div className="demo-notice"><span className="notice-pulse" /><strong>SYNTHETIC DEMONSTRATION DATA</strong><span>{sourceName} · reproducible generated event records</span><span className="notice-right">NOT REAL ORGANIZATIONAL DATA</span></div>}
    <div className="overview-grid"><section className="panel workflow-panel"><div className="panel-heading"><div><div className="panel-kicker">OBSERVED PROCESS MAP <span>01 / 03</span></div><h2>Where the work actually goes</h2></div><button className="panel-link" onClick={() => onNavigate('xray')}>OPEN X-RAY <ArrowRight size={12} /></button></div><MiniWorkflow analysis={analysis} onSelect={onSelectNode} /></section>
      <section className="panel discovery-panel"><div className="panel-heading"><div><div className="panel-kicker">SIGNAL DETECTION <span>02 / 03</span></div><h2>Emerging discoveries</h2></div><button className="panel-link" onClick={() => onNavigate('hidden')}>ALL SIGNALS <ArrowRight size={12} /></button></div>{top ? <div className="lead-discovery"><div className="finding-tag"><span className="signal-marker" />{top.category}</div><h3>{top.name}</h3><p>{top.evidence}</p><div className="finding-metrics"><span><b>{top.cases}</b> cases</span><i /><span><b>{top.percentage}%</b> affected</span><i /><span><b>{top.confidence}</b> signal</span></div><div className="hypothesis-preview"><Lightbulb size={14} /><span><b>HYPOTHESIS</b> {top.hypothesis}</span></div><button className="trace-button" onClick={() => onTrace(top)}>TRACE EVIDENCE <ArrowRight size={13} /></button></div> : <div className="no-findings">No repeated patterns were detected. A high-frequency baseline will appear when available.</div>}</section></div>
    <div className="overview-bottom"><section className="panel source-panel"><div className="panel-heading"><div><div className="panel-kicker">DATASET PROFILE <span>03 / 03</span></div><h2>Evidence at a glance</h2></div><span className="source-type"><span />{synthetic ? 'SYNTHETIC' : 'LOCAL CSV'}</span></div><div className="source-profile"><div className="source-profile-icon"><FileText size={18} /></div><div className="source-profile-name"><strong>{sourceName}</strong><span>{analysis.stats.rows.toLocaleString()} rows · {analysis.stats.systems} systems · {analysis.stats.departments} departments</span></div><button className="icon-button" aria-label="Open data source" onClick={() => onNavigate('ingest')}><ArrowRight size={15} /></button></div><div className="profile-foot"><span><Clock3 size={12} /> {formatDate(analysis.stats.start)} — {formatDate(analysis.stats.end)}</span><button onClick={() => onNavigate('ingest')}>INSPECT RECORDS <ChevronRight size={12} /></button></div></section>
      <section className="panel timeline-panel"><div className="panel-heading"><div><div className="panel-kicker">INVESTIGATION TRACE</div><h2>Analysis timeline</h2></div><button className="icon-button" aria-label="Replay investigation" onClick={onReplay}><RotateCcw size={14} /></button></div><div className="timeline-list">{stages.map((title, index) => { const complete = index < timelineCount || index < 2; return <button className={`timeline-item ${complete ? 'complete' : ''}`} key={title} onClick={() => onTimeline(index + 1)}><span className="timeline-pin">{complete ? <Check size={10} /> : <i />}</span><span>{title}</span><small>{complete ? index === 0 ? 'READY' : 'EVIDENCE' : 'PENDING'}</small></button> })}</div></section></div>
    <div className="view-footnote"><span><ShieldCheck size={12} /> CALCULATED FROM SELECTED RECORDS</span><span>Root causes are hypotheses, not confirmed facts.</span></div>
  </div>
}

function Kpi({ icon: Icon, label, value, detail, color }: { icon: typeof Activity; label: string; value: string; detail: string; color: string }) { return <div className={`kpi-card kpi-${color}`}><div className="kpi-label"><Icon size={14} />{label}<ArrowUpRight size={13} /></div><strong>{value}</strong><span>{detail}</span><div className="kpi-rule"><i /></div></div> }

function MiniWorkflow({ analysis, onSelect }: { analysis: Analysis; onSelect: (action: string) => void }) {
  const nodes = getObservedNodes(analysis).slice(0, 6)
  if (!nodes.length) return <div className="workflow-empty">No sequence available. Case identifiers and action fields are required.</div>
  return <div className="mini-workflow"><div className="workflow-axis"><span>CASE SEQUENCE · TOP OBSERVED CASE</span><span>{nodes.length} STEPS</span></div><div className="node-track">{nodes.map((node, index) => <div className="node-unit" key={`${node.action}-${index}`}><button className={`workflow-node ${node.signal ? 'node-signal' : ''} ${node.wait ? 'node-wait' : ''}`} onClick={() => onSelect(node.action)}><span className="node-index">{String(index + 1).padStart(2, '0')}</span><span className="node-icon">{node.wait ? <Clock3 size={15} /> : node.signal ? <Search size={15} /> : <Layers3 size={15} />}</span><strong>{node.action}</strong><small>{node.systems[0] ?? 'ACTIVITY'}</small><span className="node-frequency">{node.cases} CASES</span></button>{index < nodes.length - 1 && <span className="node-connector"><i /></span>}</div>)}</div><div className="workflow-legend"><span><i className="legend-square expected" />OBSERVED STEP</span><span><i className="legend-square signal" />DETECTED SIGNAL</span><span><i className="legend-square wait" />WAIT / DELAY</span><button onClick={() => onSelect(nodes[0].action)}>SELECT A NODE FOR EVIDENCE <ArrowRight size={11} /></button></div></div>
}

function getObservedNodes(analysis: Analysis) {
  const firstCase = analysis.events[0]?.caseId
  const caseEvents = analysis.events.filter((event) => event.caseId === firstCase)
  const selected = caseEvents.length ? caseEvents : analysis.events.slice(0, 8)
  const seen = new Set<string>()
  return selected.filter((event) => { const key = `${event.action.toLowerCase()}-${event.caseId}`; if (seen.has(key)) return false; seen.add(key); return true }).map((event) => {
    const group = analysis.workflow.find((item) => item.action.toLowerCase() === event.action.toLowerCase())
    return { action: event.action, systems: group?.systems ?? [], cases: group?.cases ?? 1, signal: analysis.discoveries.some((finding) => finding.actions.some((action) => action.toLowerCase() === event.action.toLowerCase())), wait: /wait|pending|stalled/i.test(`${event.action} ${event.status ?? ''}`) }
  })
}

function Xray({ analysis, scenario, mode, setMode, selectedNode, setSelectedNode, activeFinding }: { analysis: Analysis; scenario: Scenario; mode: 'observed' | 'official'; setMode: (mode: 'observed' | 'official') => void; selectedNode: string | null; setSelectedNode: (action: string | null) => void; activeFinding: Discovery | null }) {
  const actions = mode === 'official' ? scenarioOfficial[scenario] : getObservedNodes(analysis).map((node) => node.action)
  const selectedEvents = selectedNode ? analysis.events.filter((event) => event.action.toLowerCase() === selectedNode.toLowerCase()) : []
  const cases = new Set(selectedEvents.map((event) => event.caseId)).size
  const minutes = selectedEvents.reduce((sum, event) => sum + (event.durationMinutes ?? 0), 0)
  const systems = [...new Set(selectedEvents.map((event) => event.system).filter(Boolean))]
  const departments = [...new Set(selectedEvents.map((event) => event.department).filter(Boolean))]
  const linked = analysis.discoveries.filter((finding) => finding.actions.some((action) => action.toLowerCase() === selectedNode?.toLowerCase()))
  return <div className="view-content xray-content"><div className="xray-toolbar"><div className="segmented-control" role="group" aria-label="Workflow view"><button className={mode === 'official' ? 'selected' : ''} onClick={() => { setMode('official'); setSelectedNode(null) }}>OFFICIAL WORKFLOW <span>REFERENCE</span></button><button className={mode === 'observed' ? 'selected' : ''} onClick={() => { setMode('observed'); setSelectedNode(null) }}>OBSERVED WORKFLOW <span>{analysis.stats.rows} EVENTS</span></button></div><div className="map-controls"><span><i className="legend-square expected" />EXPECTED</span><span><i className="legend-square signal" />ADDITIONAL / SIGNAL</span><button title="Reset selection" aria-label="Reset selection" onClick={() => setSelectedNode(null)}><RotateCcw size={13} /></button></div></div>
    {activeFinding && <div className="trace-banner"><ScanLine size={15} /><span>TRACING <strong>{activeFinding.name}</strong> · {activeFinding.cases} affected cases</span><span>Selected steps are highlighted below</span><button onClick={() => setSelectedNode(null)} aria-label="Clear trace"><X size={14} /></button></div>}
    <section className="panel xray-map-panel"><div className="xray-map-head"><div><span>PROCESS RECONSTRUCTION / {mode === 'official' ? 'REFERENCE PATH' : 'EVENT-DERIVED PATH'}</span><strong>{mode === 'official' ? 'Documented sequence' : 'Most representative observed sequence'}</strong></div><div className="map-meta"><span>{mode === 'official' ? 'REFERENCE PROVIDED FOR SAMPLE' : 'RECONSTRUCTED FROM EVENT LOG'}</span><span>CASE {mode === 'official' ? 'STANDARD' : analysis.events[0]?.caseId ?? '—'}</span></div></div>
      <div className="xray-canvas"><div className="canvas-grid" /><div className="xray-node-row">{actions.map((action, index) => { const expected = mode === 'official' || (scenario === 'support' && supportOfficial.some((item) => item.toLowerCase() === action.toLowerCase())); const finding = analysis.discoveries.find((item) => item.actions.some((value) => value.toLowerCase() === action.toLowerCase())); const waiting = /wait|pending|stalled/i.test(action); return <div className="xray-node-wrap" key={`${action}-${index}`}><button className={`xray-node ${expected ? 'expected-node' : 'observed-extra'} ${finding ? 'signal-node' : ''} ${waiting ? 'waiting-node' : ''} ${selectedNode?.toLowerCase() === action.toLowerCase() ? 'node-selected' : ''} ${activeFinding?.actions.some((value) => value.toLowerCase() === action.toLowerCase()) ? 'node-traced' : ''}`} onClick={() => setSelectedNode(action)}><span className="xray-node-idx">STEP {String(index + 1).padStart(2, '0')}</span><span className="xray-node-icon">{waiting ? <Clock3 size={16} /> : finding ? <Search size={16} /> : <Layers3 size={16} />}</span><strong>{action}</strong><small>{mode === 'official' ? 'DOCUMENTED' : `${analysis.workflow.find((item) => item.action.toLowerCase() === action.toLowerCase())?.cases ?? 1} CASES`}</small>{finding && <em>{finding.category}</em>}</button>{index < actions.length - 1 && <div className="xray-connector"><span /><ArrowRight size={13} /></div>}</div> })}</div><div className="canvas-coordinates">SEQUENCE VIEW · SELECT ANY NODE TO INSPECT SOURCE EVENTS <span>ZOOM 100%</span></div></div>
      <div className="xray-legend"><span><i className="legend-square expected" />DOCUMENTED ACTIVITY</span><span><i className="legend-square signal" />EVIDENCE-LINKED SIGNAL</span><span><i className="legend-square wait" />WAIT STATE</span><span><GitBranch size={13} />SEQUENCE ORDERED PER CASE</span></div></section>
    <div className="evidence-grid"><section className="panel evidence-panel"><div className="panel-kicker">NODE EVIDENCE <span>01 / SELECTED STEP</span></div>{selectedNode ? <><h2>{selectedNode}</h2><p>Calculated directly from matching event records across the selected dataset.</p><div className="evidence-stat-row"><div><strong>{selectedEvents.length}</strong><span>EVENTS</span></div><div><strong>{cases}</strong><span>CASES</span></div><div><strong>{minutes ? `${Math.round(minutes)}m` : '—'}</strong><span>RECORDED TIME</span></div><div><strong>{systems.length || '—'}</strong><span>SYSTEMS</span></div></div><div className="evidence-pills">{systems.map((system) => <span key={system}><Database size={11} />{system}</span>)}{departments.map((department) => <span key={department}><Users size={11} />{department}</span>)}{!systems.length && !departments.length && <span>Optional dimensions not present in source data</span>}</div>{linked.length > 0 && <div className="linked-findings"><span>LINKED DISCOVERIES</span>{linked.map((finding) => <div key={finding.id}><span className="signal-marker" />{finding.name}<b>{finding.confidence}</b></div>)}</div></> : <div className="evidence-empty"><ScanLine size={19} /><span>SELECT A WORKFLOW NODE TO INSPECT ITS EVIDENCE</span></div>}</section>
      <section className="panel transition-panel"><div className="panel-kicker">OBSERVED TRANSITIONS <span>TOP CASE-TO-CASE EDGES</span></div><h2>Where work moves next</h2><div className="transition-list">{analysis.transitions.slice(0, 5).map((transition, index) => <button key={`${transition.from}-${transition.to}`} className="transition-row" onClick={() => setSelectedNode(transition.from)}><span className="transition-index">0{index + 1}</span><span>{transition.from}</span><ArrowRight size={12} /><strong>{transition.to}</strong><b>{transition.count}×</b></button>)}</div>{analysis.transitions.length === 0 && <p className="quiet-copy">No adjacent transitions could be derived from the available case events.</p>}</section></div>
  </div>
}

function HiddenWork({ analysis, filter, setFilter, onTrace, onIntervention }: { analysis: Analysis; filter: string; setFilter: (filter: string) => void; onTrace: (finding: Discovery) => void; onIntervention: (finding: Discovery) => void }) {
  const categories = ['ALL SIGNALS', ...new Set(analysis.discoveries.map((finding) => finding.category))]
  const filtered = filter === 'ALL SIGNALS' ? analysis.discoveries : analysis.discoveries.filter((finding) => finding.category === filter)
  return <div className="view-content hidden-content"><div className="hidden-summary panel"><div className="summary-icon"><Search size={18} /></div><div><span>CALCULATED DETECTION SUMMARY</span><strong>{analysis.discoveries.length} signals across {analysis.stats.cases} cases</strong><small>Frequencies and affected-case counts are derived from the selected event records. Hypotheses are not confirmed root causes.</small></div><div className="summary-count"><strong>{analysis.stats.rows.toLocaleString()}</strong><span>EVENTS EXAMINED</span></div></div>
    <div className="filter-row"><span>FILTER BY CATEGORY</span><div className="filter-chips">{categories.map((category) => <button key={category} className={filter === category ? 'selected' : ''} onClick={() => setFilter(category)}>{category}</button>)}</div><span className="result-count">{filtered.length} FINDINGS</span></div>
    {filtered.length ? <div className="discovery-list">{filtered.map((finding, index) => <DiscoveryCard key={finding.id} finding={finding} index={index} totalCases={analysis.stats.cases} onTrace={() => onTrace(finding)} onIntervention={() => onIntervention(finding)} />)}</div> : <div className="panel no-results"><Search size={21} /><strong>No pattern detected in this category.</strong><span>This is an evidence-based result, not a placeholder.</span></div>}
    <div className="view-footnote"><span><Lightbulb size={12} /> A ROOT-CAUSE HYPOTHESIS IS NOT A CONFIRMED CAUSE</span><span>{analysis.events.some((event) => event.durationMinutes !== undefined || event.timestamp) ? 'Time is reported only where source duration or timestamps support it.' : 'No duration or timestamp data supplied; no time impact inferred.'}</span></div>
  </div>
}

function DiscoveryCard({ finding, index, totalCases, onTrace, onIntervention }: { finding: Discovery; index: number; totalCases: number; onTrace: () => void; onIntervention: () => void }) {
  return <article className="panel discovery-card"><div className="discovery-card-main"><div className="discovery-number">0{index + 1}</div><div className="discovery-card-body"><div className="discovery-meta"><span className="finding-tag"><span className="signal-marker" />{finding.category}</span><span className={`confidence confidence-${finding.confidence.toLowerCase()}`}>{finding.confidence} EVIDENCE</span></div><h2>{finding.name}</h2><p className="discovery-evidence">{finding.evidence}</p><div className="discovery-metrics"><div><strong>{finding.frequency}</strong><span>OCCURRENCES</span></div><div><strong>{finding.cases}</strong><span>OF {totalCases} CASES</span></div><div><strong>{percent(finding.percentage)}</strong><span>CASE COVERAGE</span></div><div><strong>{finding.timeImpact ? `${Math.round(finding.timeImpact)}m` : '—'}</strong><span>RECORDED MINUTES</span></div></div><div className="discovery-tags">{finding.systems.map((system) => <span key={system}><Database size={10} />{system}</span>)}{finding.departments.map((department) => <span key={department}><Users size={10} />{department}</span>)}</div><div className="root-cause"><Lightbulb size={14} /><div><span>ROOT-CAUSE HYPOTHESIS · NOT CONFIRMED</span><p>{finding.hypothesis}</p></div></div></div></div><aside className="discovery-card-aside"><span>RECOMMENDED NEXT STEP</span><strong>{finding.intervention}</strong><small>{finding.rationale}</small><button className="trace-button" onClick={onTrace}>TRACE EVIDENCE <ArrowRight size={12} /></button><button className="secondary-action" onClick={onIntervention}>REVIEW INTERVENTION <ChevronRight size={12} /></button></aside></article>
  )
}

function Interventions({ analysis, scenario, selected, onSelect, activeFinding, onTrace, onSimulate }: { analysis: Analysis; scenario: Scenario; selected: InterventionType; onSelect: (type: InterventionType) => void; activeFinding: Discovery | null; onTrace: (finding: Discovery) => void; onSimulate: () => void }) {
  const primary = activeFinding ?? analysis.discoveries[0]
  const recommendation = primary?.intervention ?? 'DO NOTHING'
  const scenarioRationale = scenario === 'support' ? 'Employees manually retrieve information across disconnected systems. Automating those manual steps alone may preserve the underlying cause. Integration could remove unnecessary searching while retaining human judgment for customer resolution.' : primary?.rationale ?? interventionCopy[recommendation].detail
  const matching = analysis.discoveries.filter((finding) => finding.intervention === selected)
  return <div className="view-content interventions-content"><div className="intervention-callout panel"><div className="recommendation-icon"><BrainCircuit size={20} /></div><div className="recommendation-copy"><span>ENGINE RECOMMENDATION / {activeFinding?.category ?? 'HIGHEST-COVERAGE SIGNAL'}</span><h2>{recommendation} <i>— evidence-led, not automatic</i></h2><p>{scenario === 'support' && recommendation === 'INTEGRATE' ? scenarioRationale : primary?.rationale ?? scenarioRationale}</p></div><div className="recommendation-strength"><span>{primary?.confidence ?? 'EMERGING'}</span><small>evidence strength</small></div></div>
    <div className="intervention-layout"><section className="panel intervention-chooser"><div className="panel-kicker">COMPARE INTERVENTIONS <span>SELECT TO INSPECT</span></div><h2>What kind of change fits?</h2><p className="quiet-copy">Recommendations adapt to evidence; these options are not a single forced automation path.</p><div className="intervention-options">{interventionTypes.map((type, index) => { const count = analysis.discoveries.filter((finding) => finding.intervention === type).length; return <button className={`intervention-option ${selected === type ? 'chosen' : ''}`} key={type} onClick={() => onSelect(type)}><span className="intervention-option-number">0{index + 1}</span><span className="intervention-option-name">{type}<small>{interventionCopy[type].complexity}</small></span><span className="intervention-evidence-count">{count ? `${count} LINKED` : 'CANDIDATE'}</span><ChevronRight size={14} /></button> })}</div></section>
      <section className="panel intervention-detail"><div className="panel-kicker">DECISION RATIONALE <span>{selected}</span></div><div className="decision-label">SELECTED CANDIDATE</div><h2>{selected}</h2><p>{selected === recommendation ? primary?.rationale ?? scenarioRationale : interventionCopy[selected].detail}</p>{selected === recommendation && primary && <div className="supporting-evidence"><span>SUPPORTING EVIDENCE</span><p>{primary.evidence} This is event-derived evidence; it does not establish causality.</p><button onClick={() => onTrace(primary)}>OPEN SOURCE EVENTS <ArrowRight size={12} /></button></div>}<div className="decision-block"><span><ArrowUpRight size={13} /> EXPECTED BENEFIT</span><p>{selected === recommendation ? primary?.benefit ?? 'Avoid unnecessary work while preserving the baseline.' : interventionCopy[selected].detail}</p></div><div className="decision-block risk-block"><span><ShieldCheck size={13} /> RISKS & LIMITATIONS</span><p>{selected === recommendation ? primary?.risk ?? 'The source log may omit quality, policy, or outcome context.' : 'Validate this option with process owners; the event log alone does not capture every control or outcome.'}</p></div><div className="human-responsibility"><Users size={14} /><div><span>HUMAN RESPONSIBILITY RETAINED</span><p>{selected === recommendation ? primary?.human ?? 'People remain responsible for judgment, exceptions, and outcomes.' : interventionCopy[selected].responsibility}</p></div></div><div className="alternatives"><span>ALTERNATIVES & TRADE-OFF</span><p>{selected === recommendation ? primary?.alternatives ?? 'Compare candidate interventions against available evidence.' : `The engine recommends ${recommendation} for this signal. ${selected} may be less appropriate unless process owners validate that its risks are acceptable.`}</p></div><button className="primary-button decision-cta" onClick={onSimulate}>SIMULATE THIS INTERVENTION <ArrowRight size={14} /></button></section></div>
    {analysis.discoveries.length > 1 && <section className="panel finding-link-panel"><div className="panel-kicker">EVIDENCE COVERAGE <span>ALL DETECTED SIGNALS</span></div><div className="finding-link-list">{analysis.discoveries.slice(0, 5).map((finding) => <button key={finding.id} onClick={() => onTrace(finding)}><span className="signal-marker" />{finding.name}<span>{finding.intervention}</span><b>{finding.cases} CASES</b><ArrowRight size={12} /></button>)}</div></section>}
  </div>
}

function Simulator({ analysis, scenario, selected, onSelect, simulation, setSimulation, synthetic }: { analysis: Analysis; scenario: Scenario; selected: InterventionType; onSelect: (type: InterventionType) => void; simulation: { savedMinutes: number; affected: number; applied: boolean }; setSimulation: (value: { savedMinutes: number; affected: number; applied: boolean }) => void; synthetic: boolean }) {
  const baseline = scenario === 'support' && synthetic ? 31 : Math.round(analysis.stats.avgDuration ?? (scenario === 'finance' ? 27 : 24))
  const safeSavings = Math.min(simulation.savedMinutes, baseline)
  const affectedCases = Math.round(analysis.stats.cases * simulation.affected / 100)
  const future = Math.max(0, baseline - safeSavings)
  const hoursRecovered = Math.round(safeSavings * affectedCases / 60 * 10) / 10
  const humanPct = selected === 'AUTOMATE' ? 28 : selected === 'INTEGRATE' ? 62 : selected === 'AI-ASSIST' ? 72 : selected === 'REDESIGN' ? 54 : selected === 'HUMAN' ? 100 : 100
  const riskLabel = selected === 'INTEGRATE' ? 'MEDIUM · data access and source-of-truth' : selected === 'AUTOMATE' ? 'MEDIUM · exception handling' : selected === 'AI-ASSIST' ? 'MEDIUM · output review' : selected === 'REDESIGN' ? 'MEDIUM · control coverage' : 'LOW · change exposure'
  const complexity = interventionCopy[selected].complexity
  const apply = () => setSimulation({ ...simulation, applied: true })
  return <div className="view-content simulator-content"><div className="assumption-banner"><Sparkles size={15} /><div><strong>SCENARIO ASSUMPTIONS · NOT A PREDICTION</strong><span>{synthetic ? 'Support illustration uses 31m current / 21m after integration, as an editable synthetic scenario.' : 'Future-state estimates are illustrative assumptions, separate from calculated current metrics.'}</span></div><span className="assumption-stamp">{synthetic ? 'SYNTHETIC' : 'SIMULATED'}</span></div>
    <div className="simulator-grid"><section className="panel simulator-controls"><div className="panel-kicker">SCENARIO CONFIGURATION <span>LOCAL SIMULATION ONLY</span></div><h2>What if we change this?</h2><p>Adjust the assumptions to explore a potential future state. Changes affect this browser session only.</p><label className="control-label" htmlFor="intervention-choice">INTERVENTION TO MODEL</label><div className="select-control"><select id="intervention-choice" value={selected} onChange={(event) => onSelect(event.target.value as InterventionType)}>{interventionTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select><ChevronDown size={14} /></div><div className="range-control"><div className="range-label"><label htmlFor="saving-range">ASSUMED MINUTES SAVED / AFFECTED CASE</label><strong>{safeSavings} <small>min</small></strong></div><input id="saving-range" type="range" min="0" max={Math.min(25, baseline)} value={safeSavings} onChange={(event) => setSimulation({ ...simulation, savedMinutes: Number(event.target.value), applied: false })} /><div className="range-ends"><span>0 min</span><span>{Math.min(25, baseline)} min</span></div></div><div className="range-control"><div className="range-label"><label htmlFor="affected-range">PROPORTION OF CASES AFFECTED</label><strong>{simulation.affected}<small>%</small></strong></div><input id="affected-range" type="range" min="0" max="100" step="1" value={simulation.affected} onChange={(event) => setSimulation({ ...simulation, affected: Number(event.target.value), applied: false })} /><div className="range-ends"><span>0%</span><span>100%</span></div></div><div className="assumption-helper"><CircleHelp size={13} /><span>These are user-controlled assumptions, not measured savings or a validated forecast.</span></div><button className="primary-button apply-scenario" onClick={apply}>{simulation.applied ? <Check size={14} /> : <Zap size={14} />}{simulation.applied ? 'SCENARIO APPLIED LOCALLY' : 'APPLY SCENARIO'}<ArrowRight size={13} /></button>{simulation.applied && <div className="applied-note" role="status">Simulation state updated in this session. No company system was changed.</div>}</section>
      <section className="panel impact-panel"><div className="panel-heading"><div><div className="panel-kicker">BEFORE / AFTER <span>ESTIMATED SCENARIO</span></div><h2>Handling time per case</h2></div><span className="impact-icon"><BarChart3 size={16} /></span></div><div className="bar-chart"><div className="bar-row"><div className="bar-caption"><span>CURRENT BASELINE</span><strong>{baseline} <small>min</small></strong></div><div className="bar-track"><i className="bar-current" style={{ width: `${Math.max(2, baseline / Math.max(baseline, future, 1) * 100)}%` }} /></div><span className="bar-source">{synthetic && scenario === 'support' ? 'SCENARIO ASSUMPTION' : analysis.stats.avgDuration === undefined ? 'ASSUMED BASELINE' : 'EVENT DURATION AVG.'}</span></div><div className="bar-row future-row"><div className="bar-caption"><span>ESTIMATED FUTURE</span><strong>{future} <small>min</small></strong></div><div className="bar-track"><i className="bar-future" style={{ width: `${Math.max(2, future / Math.max(baseline, future, 1) * 100)}%` }} /></div><span className="bar-source">PROJECTED · NOT MEASURED</span></div><div className="saving-indicator"><span><ArrowDownRight size={16} /> {safeSavings} MINUTES / AFFECTED CASE</span><span>{baseline ? Math.round(safeSavings / baseline * 100) : 0}% LESS ASSUMED HANDLING TIME</span></div></div>
        <div className="impact-metrics"><div><span>CASES AFFECTED</span><strong>{affectedCases.toLocaleString()} <small>of {analysis.stats.cases.toLocaleString()}</small></strong><i className="mini-track"><b style={{ width: `${simulation.affected}%` }} /></i></div><div><span>CAPACITY RECOVERED</span><strong>{hoursRecovered} <small>hours / observed cases</small></strong><span className="metric-note">{safeSavings}m × {affectedCases} cases ÷ 60</span></div></div>
        <div className="impact-meta"><div><span>HUMAN INVOLVEMENT RETAINED</span><strong>{humanPct}%</strong><i className="mini-track"><b style={{ width: `${humanPct}%` }} /></i></div><div><span>IMPLEMENTATION COMPLEXITY</span><strong className="complexity-label">{complexity}</strong></div><div><span>RISK & UNCERTAINTY</span><strong className="risk-label">{riskLabel}</strong></div></div>
        <div className="sim-explanation"><Lightbulb size={14} /><span><b>CALCULATION</b> Assumed minutes saved × cases affected, divided by 60, produces illustrative capacity hours. Actual outcomes depend on quality, adoption, exception volume, and baseline accuracy.</span></div>
      </section></div>
      <div className="sim-footnote"><span><ShieldCheck size={13} /> APPLY SCENARIO ONLY UPDATES THIS LOCAL SIMULATION</span><span>Current metrics, assumptions, and projections are labeled separately.</span></div>
    </div>
  )
}
