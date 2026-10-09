export type EventRecord = {
  caseId: string
  timestamp?: string
  employeeId?: string
  department?: string
  action: string
  system?: string
  status?: string
  durationMinutes?: number
}

export type ScenarioId = 'support' | 'finance' | 'hr' | 'upload'
export type InterventionType = 'INTEGRATE' | 'AI-ASSIST' | 'AUTOMATE' | 'REDESIGN' | 'HUMAN' | 'DO NOTHING'

export type Discovery = {
  id: string
  name: string
  category: string
  evidence: string
  cases: number
  frequency: number
  percentage: number
  timeImpact?: number
  systems: string[]
  departments: string[]
  confidence: 'HIGH' | 'MEDIUM' | 'EMERGING'
  hypothesis: string
  intervention: InterventionType
  rationale: string
  benefit: string
  risk: string
  human: string
  alternatives: string
  actions: string[]
}

export type Analysis = {
  events: EventRecord[]
  stats: { rows: number; cases: number; employees: number; departments: number; systems: number; start?: string; end?: string; avgDuration?: number }
  discoveries: Discovery[]
  workflow: { action: string; count: number; cases: number; duration?: number; systems: string[]; departments: string[]; kind: 'observed' | 'expected' | 'signal' }[]
  transitions: { from: string; to: string; count: number }[]
  scenario: ScenarioId
}

const definitions: Record<Exclude<ScenarioId, 'upload'>, { department: string; employees: string[]; systems: string[]; steps: string[][] }> = {
  support: {
    department: 'Customer Experience', employees: ['CX-014', 'CX-022', 'CX-031', 'FIN-008'], systems: ['Atlas CRM', 'Outlook', 'LedgerPro', 'Support Hub'],
    steps: [['Open ticket', 'Search CRM', 'Search email', 'Contact Finance', 'Wait for response', 'Return to CRM', 'Update ticket', 'Resolve ticket'], ['Open ticket', 'Search CRM', 'Search email', 'Wait for response', 'Return to CRM', 'Update ticket', 'Resolve ticket'], ['Open ticket', 'Search CRM', 'Search email', 'Contact Finance', 'Wait for response', 'Return to CRM', 'Search CRM', 'Update ticket', 'Resolve ticket']],
  },
  finance: {
    department: 'Finance Operations', employees: ['FIN-011', 'FIN-016', 'FIN-024', 'OPS-009'], systems: ['LedgerPro', 'Sheets', 'Bank Portal', 'ERP Core'],
    steps: [['Open batch', 'Export transactions', 'Re-enter record', 'Match invoice', 'Reconcile account', 'Re-enter record', 'Review exception', 'Close batch'], ['Open batch', 'Export transactions', 'Match invoice', 'Reconcile account', 'Reconcile account', 'Review exception', 'Close batch'], ['Open batch', 'Export transactions', 'Re-enter record', 'Match invoice', 'Reconcile account', 'Re-enter record', 'Close batch']],
  },
  hr: {
    department: 'People Operations', employees: ['HR-006', 'HR-018', 'HR-027', 'MGR-004'], systems: ['PeopleDesk', 'DocuSign', 'Email', 'Access Portal'],
    steps: [['Open request', 'Review document', 'Request document', 'Wait for approval', 'Route to manager', 'Wait for approval', 'Clarify ownership', 'Approve request'], ['Open request', 'Review document', 'Request document', 'Wait for approval', 'Route to manager', 'Approve request'], ['Open request', 'Review document', 'Route to manager', 'Wait for approval', 'Request document', 'Wait for approval', 'Approve request']],
  },
}

function hashSeed(value: string) { return [...value].reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0, 7) }
function pseudo(seed: number) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 } }

export function createSampleEvents(scenario: Exclude<ScenarioId, 'upload'>): EventRecord[] {
  const def = definitions[scenario]
  const random = pseudo(hashSeed(scenario))
  const events: EventRecord[] = []
  const start = Date.UTC(2026, 8, 1, 8)
  const allActions = [...new Set(def.steps.flat())]
  for (let caseIndex = 0; caseIndex < 84; caseIndex++) {
    const steps = def.steps[Math.floor(random() * def.steps.length)]
    const caseId = `${scenario.toUpperCase()}-${String(1000 + caseIndex).slice(1)}`
    const department = scenario === 'support' && caseIndex % 5 === 0 ? 'Finance' : def.department
    let time = start + caseIndex * 3_600_000 + Math.floor(random() * 900_000)
    steps.forEach((action, index) => {
      const isWait = /wait/i.test(action)
      const system = /email|wait|contact|clarify/i.test(action) ? (scenario === 'support' ? 'Outlook' : scenario === 'hr' ? 'Email' : 'Sheets') : def.systems[(index + caseIndex) % def.systems.length]
      const duration = isWait ? 25 + Math.round(random() * 95) : 2 + Math.round(random() * (scenario === 'finance' ? 14 : 10))
      time += (duration + Math.round(random() * 5)) * 60_000
      events.push({ caseId, timestamp: new Date(time).toISOString(), employeeId: def.employees[(index + caseIndex) % def.employees.length], department, action, system, status: isWait ? 'waiting' : 'completed', durationMinutes: duration })
    })
  }
  void allActions
  return events
}

const aliases: Record<string, string[]> = {
  caseId: ['case_id', 'case', 'ticket_id', 'request_id', 'caseid'], timestamp: ['timestamp', 'event_time', 'datetime', 'created_at', 'time'],
  employeeId: ['employee_id', 'employee', 'user_id', 'actor', 'owner'], department: ['department', 'team', 'business_unit'],
  action: ['action', 'activity', 'task_name', 'event', 'step'], system: ['system', 'application', 'tool', 'app'],
  status: ['status', 'state', 'outcome'], durationMinutes: ['duration_minutes', 'duration', 'minutes', 'elapsed_minutes'],
}
const normalizeHeader = (header: string) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s-]+/g, '_')

export function parseCsv(text: string): { events: EventRecord[]; mappings: string[]; headers: string[] } {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field. Check the file and try again.')
  const headers = rows.shift()?.map(normalizeHeader) ?? []
  if (!headers.length || !rows.length) throw new Error('The CSV needs a header row and at least one data row.')
  const indexes: Partial<Record<keyof typeof aliases, number>> = {}
  const mappings: string[] = []
  for (const [field, names] of Object.entries(aliases) as [keyof typeof aliases, string[]][]) {
    const index = headers.findIndex((header) => names.includes(header))
    if (index >= 0) { indexes[field] = index; if (headers[index] !== names[0]) mappings.push(`${headers[index]} → ${field}`) }
  }
  if (indexes.action === undefined) throw new Error('Could not identify an activity column. Add an action, activity, task_name, event, or step column.')
  if (indexes.caseId === undefined) throw new Error('Could not identify a case column. Add case_id, case, ticket_id, or request_id.')
  const events = rows.filter((cells) => cells.some((value) => value.trim())).map((cells, index) => {
    const get = (field: keyof typeof aliases) => { const at = indexes[field]; return at === undefined ? '' : (cells[at] ?? '').trim() }
    const durationValue = Number(get('durationMinutes'))
    return { caseId: get('caseId') || `ROW-${index + 1}`, action: get('action'), ...(get('timestamp') ? { timestamp: get('timestamp') } : {}), ...(get('employeeId') ? { employeeId: get('employeeId') } : {}), ...(get('department') ? { department: get('department') } : {}), ...(get('system') ? { system: get('system') } : {}), ...(get('status') ? { status: get('status') } : {}), ...(Number.isFinite(durationValue) && durationValue >= 0 && get('durationMinutes') ? { durationMinutes: durationValue } : {}) }
  }).filter((event) => event.action)
  if (!events.length) throw new Error('No usable event records were found. Check that activity values are populated.')
  return { events, mappings, headers }
}

const unique = (values: (string | undefined)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))]
const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function recommendationFor(pattern: string, scenario: ScenarioId): { intervention: InterventionType; rationale: string; benefit: string; risk: string; human: string; alternatives: string } {
  const lower = pattern.toLowerCase()
  if (/system|search|switch|information|context/.test(lower)) return { intervention: 'INTEGRATE', rationale: 'Repeated work crosses application boundaries. Automating the workaround would preserve the missing information flow; connect the systems at the source.', benefit: 'Reduce context switching and duplicate retrieval while improving information continuity.', risk: 'Integration quality, access controls, and source-of-truth ownership must be validated.', human: 'Retain human judgment for customer, exception, and accountability decisions.', alternatives: 'AI-assist can summarize retrieved context, but cannot replace a reliable underlying information flow.' }
  if (/wait|delay|handoff|approval|ownership|loop/.test(lower)) return { intervention: 'REDESIGN', rationale: 'The event sequence points to a process or ownership bottleneck. Simplify routing and clarify decision rights before automating the loop.', benefit: 'Shorter queues and fewer avoidable handoffs.', risk: 'Changing approval paths can alter control coverage and requires stakeholder review.', human: 'Keep accountable owners in decisions that require policy or contextual judgment.', alternatives: 'Automation could accelerate a flawed approval loop without removing its cause.' }
  if (/match|reconcil|re.enter|duplicate|entry/.test(lower)) return { intervention: 'AUTOMATE', rationale: 'Repeated, structured record operations appear suitable for deterministic matching with explicit confidence thresholds and exception routing.', benefit: 'Reduce repetitive processing and improve consistency.', risk: 'Bad source data and edge cases can produce incorrect matches; monitor exception rates.', human: 'People should review ambiguous matches and own financial exceptions.', alternatives: 'AI-assist is less appropriate for deterministic matching where auditable rules are available.' }
  if (/document|search|summar|retrieve/.test(lower)) return { intervention: 'AI-ASSIST', rationale: 'The work involves collecting or preparing context; an assistant can draft or summarize while a person verifies accuracy.', benefit: 'Reduce preparation effort without transferring accountability.', risk: 'Generated summaries can omit nuance or contain errors; source references and review are required.', human: 'A responsible employee verifies context and makes the final decision.', alternatives: 'Full automation is not justified without stronger evidence of stable, rules-based decisions.' }
  return { intervention: scenario === 'hr' ? 'HUMAN' : 'DO NOTHING', rationale: 'Available events do not establish that changing this activity would improve outcomes safely.', benefit: 'Avoid unnecessary change while retaining a measurable baseline.', risk: 'The event log may omit quality, policy, or customer outcome context.', human: 'Keep the current accountable owner and gather outcome evidence.', alternatives: 'Revisit automation or redesign after richer evidence is available.' }
}

export function analyzeEvents(input: EventRecord[], scenario: ScenarioId): Analysis {
  const events = [...input].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
  const caseIds = unique(events.map((event) => event.caseId))
  const employees = unique(events.map((event) => event.employeeId))
  const departments = unique(events.map((event) => event.department))
  const systems = unique(events.map((event) => event.system))
  const timestamps = events.map((event) => event.timestamp).filter((value): value is string => Boolean(value)).sort()
  const durations = events.map((event) => event.durationMinutes).filter((value): value is number => Number.isFinite(value))
  const caseEvents = new Map<string, EventRecord[]>()
  events.forEach((event) => caseEvents.set(event.caseId, [...(caseEvents.get(event.caseId) ?? []), event]))
  const actions = new Map<string, { events: EventRecord[]; cases: Set<string> }>()
  events.forEach((event) => {
    const key = norm(event.action)
    const entry = actions.get(key) ?? { events: [], cases: new Set<string>() }
    entry.events.push(event); entry.cases.add(event.caseId); actions.set(key, entry)
  })
  const seenActions = new Map<string, number>()
  const repeatEvents: EventRecord[] = []
  for (const caseList of caseEvents.values()) for (const event of caseList) {
    const key = `${event.caseId}:${norm(event.action)}`
    if (seenActions.has(key)) repeatEvents.push(event)
    seenActions.set(key, (seenActions.get(key) ?? 0) + 1)
  }
  const switches = new Map<string, Set<string>>()
  const handoffCases = new Set<string>()
  const waitEvents = events.filter((event) => /wait|pending|stalled|await/i.test(`${event.action} ${event.status ?? ''}`))
  for (const [caseId, caseList] of caseEvents) {
    const ordered = [...caseList].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
    let switchCount = 0, previousSystem = ''
    for (const event of ordered) {
      if (event.system && previousSystem && event.system !== previousSystem) switchCount++
      if (event.system) previousSystem = event.system
    }
    if (switchCount) switches.set(caseId, new Set([String(switchCount)]))
    if (unique(ordered.map((event) => event.department)).length > 1 || unique(ordered.map((event) => event.employeeId)).length > 1) handoffCases.add(caseId)
  }
  const findings: Omit<Discovery, 'id' | 'confidence' | 'intervention' | 'rationale' | 'benefit' | 'risk' | 'human' | 'alternatives'>[] = []
  const push = (name: string, category: string, affectedEvents: EventRecord[], affectedCases: Set<string>, evidence: string, hypothesis: string, actionsUsed: string[], timeImpact?: number) => {
    if (!affectedCases.size) return
    findings.push({ name, category, evidence, cases: affectedCases.size, frequency: affectedEvents.length, percentage: Math.round((affectedCases.size / Math.max(1, caseIds.length)) * 100), timeImpact, systems: unique(affectedEvents.map((event) => event.system)), departments: unique(affectedEvents.map((event) => event.department)), hypothesis, actions: actionsUsed })
  }
  const repeatedByCase = new Set(repeatEvents.map((event) => event.caseId))
  if (repeatedByCase.size) push('Repeated activity loops', 'PROCESS LOOP', repeatEvents, repeatedByCase, `${repeatEvents.length} repeated activity events across ${repeatedByCase.size} cases.`, 'Repeated steps may indicate rework, missing information, or a correction loop. The event log does not confirm which cause applies.', unique(repeatEvents.map((event) => event.action)), repeatEvents.reduce((sum, event) => sum + (event.durationMinutes ?? 0), 0))
  const switchCases = new Set(switches.keys())
  if (systems.length > 1 && switchCases.size) {
    const switchEvents = events.filter((event) => event.system)
    const switchCount = [...switches.values()].reduce((sum, set) => sum + Number([...set][0]), 0)
    push('Cross-system navigation', 'SYSTEM SWITCHING', switchEvents, switchCases, `${switchCount} system transitions observed across ${switchCases.size} cases using ${systems.length} systems.`, 'Information may be fragmented across tools. A shared record or integration could reduce retrieval work; system switching alone does not prove a root cause.', unique(switchEvents.map((event) => event.action)))
  }
  if (waitEvents.length) {
    const waitCases = new Set(waitEvents.map((event) => event.caseId))
    const waitDuration = waitEvents.reduce((sum, event) => sum + (event.durationMinutes ?? 0), 0)
    push('Waiting and stalled work', 'WAIT STATE', waitEvents, waitCases, `${waitEvents.length} wait/status events across ${waitCases.size} cases${waitDuration ? `; ${Math.round(waitDuration / waitCases.size)} recorded minutes per affected case on average` : ''}.`, 'A wait state may reflect a response dependency or queue. Timestamps and status capture indicate elapsed work, not why the delay occurred.', unique(waitEvents.map((event) => event.action)), waitDuration || undefined)
  }
  if (handoffCases.size) {
    const handoffEvents = events.filter((event) => handoffCases.has(event.caseId))
    push('Cross-owner handoffs', 'OWNERSHIP TRANSFER', handoffEvents, handoffCases, `${handoffCases.size} cases span multiple employees or departments.`, 'Multiple owners can signal necessary specialization or unclear ownership. Validate expected roles before changing routing.', unique(handoffEvents.map((event) => event.action)))
  }
  const keywordPattern = /manual|re.?enter|reconcil|match|approval|request document|search|contact|clarify/i
  const keywordEvents = events.filter((event) => keywordPattern.test(event.action))
  const keywordCases = new Set(keywordEvents.map((event) => event.caseId))
  if (keywordEvents.length) {
    const groups = new Map<string, EventRecord[]>()
    keywordEvents.forEach((event) => { const group = /re.?enter|reconcil|match/i.test(event.action) ? 'Repeated record operations' : /approval|request document/i.test(event.action) ? 'Approval and document work' : 'Information retrieval work'; groups.set(group, [...(groups.get(group) ?? []), event]) })
    for (const [name, groupEvents] of groups) {
      const groupCases = new Set(groupEvents.map((event) => event.caseId))
      if (groupEvents.length < 2) continue
      const hypothesis = /record/i.test(name) ? 'Repeated record operations could reflect duplicate entry or matching work. Confirm source-of-truth and exception rules before automation.' : /Approval/i.test(name) ? 'Approval or document requests may point to unnecessary loops, unclear ownership, or policy requirements; the log cannot distinguish among them.' : 'Repeated retrieval or contact activity may indicate information gaps. Investigate the upstream information flow before automating the workaround.'
      push(name, /record/i.test(name) ? 'REPETITIVE OPERATIONS' : /Approval/i.test(name) ? 'PROCESS DESIGN' : 'INFORMATION RETRIEVAL', groupEvents, groupCases, `${groupEvents.length} matching events across ${groupCases.size} cases.`, hypothesis, unique(groupEvents.map((event) => event.action)), groupEvents.reduce((sum, event) => sum + (event.durationMinutes ?? 0), 0) || undefined)
    }
  }
  if (!findings.length) {
    const top = [...actions.entries()].sort((a, b) => b[1].events.length - a[1].events.length)[0]
    if (top) push('High-volume activity', 'ACTIVITY FREQUENCY', top[1].events, top[1].cases, `${top[1].events.length} events across ${top[1].cases.size} cases.`, 'This activity occurs often, but frequency alone is not evidence that it should change.', [top[1].events[0].action])
  }
  const discoveries: Discovery[] = findings.sort((a, b) => b.cases - a.cases).map((finding, index) => {
    const recommended = recommendationFor(`${finding.name} ${finding.category}`, scenario)
    return { ...finding, id: `finding-${index + 1}`, confidence: finding.cases / Math.max(1, caseIds.length) > 0.6 ? 'HIGH' : finding.cases / Math.max(1, caseIds.length) > 0.25 ? 'MEDIUM' : 'EMERGING', ...recommended }
  })
  const workflow = [...actions.entries()].map(([key, value]) => ({ action: value.events[0].action, count: value.events.length, cases: value.cases.size, duration: avg(value.events.map((event) => event.durationMinutes).filter((duration): duration is number => duration !== undefined)), systems: unique(value.events.map((event) => event.system)), departments: unique(value.events.map((event) => event.department)), kind: discoveries.some((finding) => finding.actions.some((action) => norm(action) === key)) ? 'signal' as const : 'observed' as const })).sort((a, b) => b.count - a.count).slice(0, 12)
  const transitions: Analysis['transitions'] = []
  const transitionMap = new Map<string, number>()
  for (const caseList of caseEvents.values()) {
    const ordered = [...caseList].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
    for (let index = 0; index < ordered.length - 1; index++) {
      const from = ordered[index].action, to = ordered[index + 1].action
      const key = `${from}\u0000${to}`
      transitionMap.set(key, (transitionMap.get(key) ?? 0) + 1)
    }
  }
  transitionMap.forEach((count, key) => { const [from, to] = key.split('\u0000'); transitions.push({ from, to, count }) })
  return { events, stats: { rows: events.length, cases: caseIds.length, employees: employees.length, departments: departments.length, systems: systems.length, ...(timestamps.length ? { start: timestamps[0], end: timestamps.at(-1) } : {}), ...(durations.length ? { avgDuration: avg(durations) } : {}) }, discoveries, workflow, transitions: transitions.sort((a, b) => b.count - a.count).slice(0, 18), scenario }
}
