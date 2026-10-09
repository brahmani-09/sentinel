export type ScenarioId = "support" | "finance" | "hr" | "uploaded"
export type Intervention = "INTEGRATE" | "AUTOMATE" | "AI-ASSIST" | "HUMAN" | "REDESIGN" | "DO NOTHING"

export type EventRecord = {
  case_id: string
  timestamp?: string
  employee_id?: string
  department?: string
  action: string
  system?: string
  status?: string
  duration_minutes?: number
}

export type DatasetStats = {
  rows: number
  cases: number
  employees: number
  departments: number
  systems: number
  start?: string
  end?: string
  durationMinutes: number
  hasTimestamps: boolean
  hasDurations: boolean
}

export type Finding = {
  id: string
  name: string
  category: string
  description: string
  hypothesis: string
  casesAffected: number
  frequency: number
  rate: number
  minutesPerCase?: number
  systems: string[]
  departments: string[]
  confidence: "HIGH" | "MEDIUM" | "EARLY SIGNAL"
  evidenceActions: string[]
  intervention: Intervention
  rationale: string
  benefits: string
  risks: string
  humanRole: string
  alternatives: { type: Intervention; reason: string }[]
}

export type AnalysisResult = {
  events: EventRecord[]
  stats: DatasetStats
  findings: Finding[]
  workflow: { action: string; count: number; systems: string[]; cases: number; minutes: number; kind: "expected" | "observed" | "wait" | "handoff" }[]
  scenario: ScenarioId
  title: string
  summary: string
}

const scenarioConfig: Record<Exclude<ScenarioId, "uploaded">, { title: string; department: string; systems: string[]; actions: string[] }> = {
  support: {
    title: "Customer support",
    department: "Customer Experience",
    systems: ["Helix CRM", "Outlook", "Ledger Core"],
    actions: ["Open ticket", "Check customer", "Search CRM", "Search email", "Contact Finance", "Wait for response", "Return to CRM", "Update ticket", "Resolve ticket"],
  },
  finance: {
    title: "Finance operations",
    department: "Finance Operations",
    systems: ["Ledger Core", "Sheets", "ERP Cloud"],
    actions: ["Open reconciliation", "Retrieve statement", "Search ERP", "Match transaction", "Re-enter record", "Verify variance", "Request clarification", "Wait for response", "Post adjustment", "Close reconciliation"],
  },
  hr: {
    title: "Human resources",
    department: "People Operations",
    systems: ["PeopleHub", "DocuVault", "Email"],
    actions: ["Open request", "Review employee file", "Request document", "Wait for document", "Route for approval", "Wait for approval", "Return for correction", "Clarify ownership", "Update case", "Close request"],
  },
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function createSampleEvents(scenario: Exclude<ScenarioId, "uploaded">): EventRecord[] {
  const config = scenarioConfig[scenario]
  const random = seededRandom(scenario === "support" ? 917 : scenario === "finance" ? 421 : 808)
  const events: EventRecord[] = []
  const base = new Date("2025-04-01T08:00:00.000Z")
  const caseCount = 60
  for (let index = 0; index < caseCount; index += 1) {
    const caseId = `${scenario.toUpperCase()}-${String(index + 1).padStart(4, "0")}`
    const employee = `${scenario.toUpperCase()}-E${String(1 + Math.floor(random() * 18)).padStart(2, "0")}`
    const variation = index % 5
    let sequence: string[]
    if (scenario === "support") {
      sequence = ["Open ticket", "Check customer", "Search CRM", "Search email", "Contact Finance", "Wait for response", "Return to CRM", "Update ticket", "Resolve ticket"]
      if (variation === 1 || variation === 4) sequence.splice(5, 0, "Search email")
      if (variation === 2) sequence.splice(4, 1)
    } else if (scenario === "finance") {
      sequence = ["Open reconciliation", "Retrieve statement", "Search ERP", "Match transaction", "Re-enter record", "Verify variance", "Post adjustment", "Close reconciliation"]
      if (variation !== 2) sequence.splice(4, 0, "Match transaction")
      if (variation === 0 || variation === 3) sequence.splice(5, 0, "Re-enter record")
      if (variation === 1 || variation === 4) sequence.splice(6, 0, "Wait for response")
    } else {
      sequence = ["Open request", "Review employee file", "Request document", "Wait for document", "Route for approval", "Wait for approval", "Update case", "Close request"]
      if (variation !== 2) sequence.splice(6, 0, "Return for correction")
      if (variation === 0 || variation === 3) sequence.splice(7, 0, "Route for approval")
      if (variation === 1 || variation === 4) sequence.splice(6, 0, "Clarify ownership")
    }
    let offsetMinutes = index * 47 + Math.floor(random() * 18)
    sequence.forEach((action, eventIndex) => {
      const system = action.includes("email") || action.includes("response") || action.includes("document") || action.includes("approval") || action.includes("clarification")
        ? (scenario === "support" ? "Outlook" : scenario === "finance" ? "Email" : "Email")
        : action.includes("CRM") || action.includes("ticket") || action.includes("customer")
          ? config.systems[0]
          : action.includes("ERP") || action.includes("transaction") || action.includes("reconciliation") || action.includes("statement") || action.includes("record") || action.includes("adjustment")
            ? config.systems[scenario === "finance" ? 2 : 0]
            : config.systems[1]
      const isWait = action.toLowerCase().includes("wait")
      const duration = isWait ? (scenario === "hr" ? 75 + Math.floor(random() * 110) : 32 + Math.floor(random() * 68)) : 2 + Math.floor(random() * 7)
      const timestamp = new Date(base.getTime() + offsetMinutes * 60000).toISOString()
      events.push({
        case_id: caseId,
        timestamp,
        employee_id: action === "Contact Finance" || action === "Route for approval" ? `${scenario.toUpperCase()}-E${String(20 + Math.floor(random() * 6)).padStart(2, "0")}` : employee,
        department: action === "Contact Finance" ? "Finance" : action === "Route for approval" ? "People Leadership" : config.department,
        action,
        system,
        status: isWait ? "waiting" : "completed",
        duration_minutes: duration,
      })
      offsetMinutes += duration + (isWait ? duration : 3)
      if (eventIndex === 2 && scenario === "support") offsetMinutes += 5
    })
  }
  return events
}

function unique(values: (string | undefined)[]) {
  return new Set(values.filter((value): value is string => Boolean(value?.trim()))).size
}

export function getDatasetStats(events: EventRecord[]): DatasetStats {
  const timestamps = events.map((event) => event.timestamp).filter((value): value is string => Boolean(value) && !Number.isNaN(Date.parse(value))).sort()
  const durations = events.map((event) => event.duration_minutes).filter((value): value is number => Number.isFinite(value) && value >= 0)
  return {
    rows: events.length,
    cases: unique(events.map((event) => event.case_id)),
    employees: unique(events.map((event) => event.employee_id)),
    departments: unique(events.map((event) => event.department)),
    systems: unique(events.map((event) => event.system)),
    start: timestamps[0],
    end: timestamps[timestamps.length - 1],
    durationMinutes: durations.reduce((sum, value) => sum + value, 0),
    hasTimestamps: timestamps.length > 0,
    hasDurations: durations.length > 0,
  }
}

const aliases: Record<keyof EventRecord, string[]> = {
  case_id: ["case_id", "case", "ticket_id", "ticket", "request_id", "process_instance", "caseid"],
  timestamp: ["timestamp", "event_time", "time", "datetime", "created_at", "occurred_at"],
  employee_id: ["employee_id", "employee", "user_id", "actor", "owner", "agent_id"],
  department: ["department", "team", "business_unit", "function"],
  action: ["action", "activity", "task_name", "task", "event", "step", "event_name"],
  system: ["system", "application", "tool", "app", "platform"],
  status: ["status", "state", "result"],
  duration_minutes: ["duration_minutes", "duration", "minutes", "elapsed_minutes", "duration_min"],
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "")
}

export type CsvParseResult = { events: EventRecord[]; mappings: { source: string; target: string }[]; headers: string[] }

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1 }
      else quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(cell); cell = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      row.push(cell); rows.push(row); row = []; cell = ""
    } else cell += char
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((record) => record.some((value) => value.trim().length > 0))
}

export function parseAndNormalizeCsv(text: string): CsvParseResult {
  const table = parseCsvRows(text.replace(/^\uFEFF/, ""))
  if (table.length < 2) throw new Error("The CSV needs a header row and at least one event record.")
  const headers = table[0].map((header) => header.trim())
  const normalized = headers.map(normalizeHeader)
  const columnMap = new Map<keyof EventRecord, number>()
  const mappings: { source: string; target: string }[] = []
  for (const field of Object.keys(aliases) as (keyof EventRecord)[]) {
    const index = normalized.findIndex((header) => aliases[field].includes(header))
    if (index >= 0) {
      columnMap.set(field, index)
      if (normalizeHeader(headers[index]) !== field) mappings.push({ source: headers[index], target: field })
    }
  }
  if (!columnMap.has("case_id")) throw new Error("A case identifier is required. Supported columns include case_id, case, or ticket_id.")
  if (!columnMap.has("action")) throw new Error("An activity column is required. Supported columns include action, activity, or task_name.")
  const events = table.slice(1).map((row, index) => {
    const get = (field: keyof EventRecord) => {
      const columnIndex = columnMap.get(field)
      return columnIndex === undefined ? "" : (row[columnIndex] ?? "").trim()
    }
    const caseId = get("case_id")
    const action = get("action")
    if (!caseId || !action) throw new Error(`Row ${index + 2} is missing a case identifier or activity.`)
    const durationText = get("duration_minutes")
    const duration = durationText === "" ? undefined : Number(durationText)
    if (durationText !== "" && (!Number.isFinite(duration) || duration! < 0)) throw new Error(`Row ${index + 2} has an invalid duration. Use a non-negative number of minutes.`)
    const timestamp = get("timestamp")
    return {
      case_id: caseId,
      action,
      ...(get("timestamp") ? { timestamp } : {}),
      ...(get("employee_id") ? { employee_id: get("employee_id") } : {}),
      ...(get("department") ? { department: get("department") } : {}),
      ...(get("system") ? { system: get("system") } : {}),
      ...(get("status") ? { status: get("status") } : {}),
      ...(duration !== undefined ? { duration_minutes: duration } : {}),
    } satisfies EventRecord
  })
  if (!events.length) throw new Error("No usable event records were found in this CSV.")
  return { events, mappings, headers }
}

function interventionFor(scenario: ScenarioId, type: string): Intervention {
  const lower = type.toLowerCase()
  if (lower.includes("system") || lower.includes("switch") || lower.includes("search") || lower.includes("duplicat")) return "INTEGRATE"
  if (lower.includes("wait") || lower.includes("handoff") || lower.includes("approval") || lower.includes("loop") || lower.includes("repeat")) {
    if (scenario === "hr") return "REDESIGN"
    if (scenario === "finance" && lower.includes("repeat")) return "AUTOMATE"
    return "REDESIGN"
  }
  if (scenario === "finance") return "AUTOMATE"
  return "AI-ASSIST"
}

const rationaleByIntervention: Record<Intervention, { rationale: string; benefits: string; risks: string; humanRole: string; alternative: Intervention }> = {
  INTEGRATE: { rationale: "The evidence points to work created by information moving between disconnected systems. Fixing the handoff at its source is safer than automating the workaround.", benefits: "Less searching, fewer duplicate updates, and a more complete operating record.", risks: "Connector quality, permissions, and data ownership need careful validation.", humanRole: "Review retrieved context and retain accountable decisions.", alternative: "AI-ASSIST" },
  AUTOMATE: { rationale: "This activity is repeatable and rules-based in the observed records, making a bounded automation candidate.", benefits: "Reduce repetitive handling while improving consistency and throughput.", risks: "Exceptions and changing rules can create silent errors without monitoring.", humanRole: "Own exception review, thresholds, and periodic quality checks.", alternative: "INTEGRATE" },
  "AI-ASSIST": { rationale: "The work benefits from gathering or summarizing context, while a human should validate the result.", benefits: "Faster preparation with the decision-maker still in control.", risks: "Generated summaries can omit nuance or misstate source context.", humanRole: "Verify source evidence and approve any customer or employee-facing action.", alternative: "AUTOMATE" },
  HUMAN: { rationale: "The observed step involves accountability or contextual judgment that should remain with a responsible person.", benefits: "Preserve nuance, trust, and clear accountability.", risks: "Human-only handling can remain capacity constrained.", humanRole: "Make and document the final decision.", alternative: "AI-ASSIST" },
  REDESIGN: { rationale: "The pattern suggests a process-design issue—such as a loop, stalled ownership, or avoidable approval—not simply a task to accelerate.", benefits: "Remove unnecessary work at its source and clarify the path to completion.", risks: "Changing governance can affect stakeholders and needs policy review.", humanRole: "Process owners approve the revised path and monitor exceptions.", alternative: "AUTOMATE" },
  "DO NOTHING": { rationale: "Evidence is too limited or risk is disproportionate to justify changing this activity now.", benefits: "Avoid costly change where value has not been demonstrated.", risks: "The current friction may persist until stronger evidence is collected.", humanRole: "Continue monitoring and gather representative evidence.", alternative: "REDESIGN" },
}

export function analyzeEvents(events: EventRecord[], scenario: ScenarioId, title?: string): AnalysisResult {
  const stats = getDatasetStats(events)
  const cases = new Map<string, EventRecord[]>()
  events.forEach((event) => cases.set(event.case_id, [...(cases.get(event.case_id) ?? []), event]))
  const caseCount = Math.max(stats.cases, 1)
  const normalizedCaseValues = [...cases.values()].map((list) => [...list].sort((a, b) => (a.timestamp && b.timestamp ? Date.parse(a.timestamp) - Date.parse(b.timestamp) : 0)))
  const actionMap = new Map<string, { events: EventRecord[]; cases: Set<string> }>()
  events.forEach((event) => {
    const key = event.action.trim()
    const current = actionMap.get(key) ?? { events: [], cases: new Set<string>() }
    current.events.push(event); current.cases.add(event.case_id); actionMap.set(key, current)
  })
  const findingSpecs: { id: string; name: string; category: string; predicate: (event: EventRecord, list: EventRecord[]) => boolean; hypothesis: string }[] = [
    { id: "repeated", name: "Repeated activity loops", category: "REWORK", predicate: (event, list) => list.filter((item) => item.action === event.action).length > 1, hypothesis: "A repeated activity may reflect missing information, an avoidable re-check, or an exception path. Confirm with process owners before changing the flow." },
    { id: "system-switch", name: "Cross-system searching", category: "SYSTEM FRICTION", predicate: (event) => /search|retrieve|look.?up|check|find/i.test(event.action), hypothesis: "People may be manually bridging information that is not visible in the system where the work is completed." },
    { id: "waiting", name: "Waiting and stalled work", category: "QUEUE TIME", predicate: (event) => /wait|pending|await|hold/i.test(`${event.action} ${event.status ?? ""}`), hypothesis: "Elapsed time may be driven by an external response or queue, rather than active handling. Timestamp gaps are not assumed unless the records support them." },
    { id: "handoff", name: "Cross-team handoffs", category: "OWNERSHIP", predicate: (event, list) => /contact|route|handoff|forward|assign|approval/i.test(event.action) || (Boolean(event.department) && list.some((item) => item.case_id === event.case_id && item.department && item.department !== event.department)), hypothesis: "Work may be crossing team boundaries without a clear owner or shared context." },
    { id: "manual-entry", name: "Manual re-entry and reconciliation", category: "DUPLICATE WORK", predicate: (event) => /re.enter|reconcile|match|duplicate|copy|manual/i.test(event.action), hypothesis: "Repeated matching or re-entry may indicate the same data is being maintained in more than one place." },
  ]
  const findings: Finding[] = []
  for (const spec of findingSpecs) {
    const hitEvents = events.filter((event) => spec.predicate(event, cases.get(event.case_id) ?? []))
    const affected = new Set(hitEvents.map((event) => event.case_id))
    if (!hitEvents.length) continue
    const affectedEvents = hitEvents
    const systems = [...new Set(affectedEvents.map((event) => event.system).filter((value): value is string => Boolean(value)))].slice(0, 4)
    const departments = [...new Set(affectedEvents.map((event) => event.department).filter((value): value is string => Boolean(value)))].slice(0, 4)
    const durationList = hitEvents.map((event) => event.duration_minutes).filter((value): value is number => Number.isFinite(value))
    const avgDuration = durationList.length ? durationList.reduce((sum, value) => sum + value, 0) / affected.size : undefined
    const confidence = affected.size / caseCount > 0.6 ? "HIGH" : affected.size / caseCount > 0.25 ? "MEDIUM" : "EARLY SIGNAL"
    const intervention = interventionFor(scenario, spec.name)
    const reasoning = rationaleByIntervention[intervention]
    findings.push({
      id: spec.id,
      name: spec.name,
      category: spec.category,
      description: `${affected.size} of ${caseCount} cases contain ${spec.name.toLowerCase()} evidence across ${hitEvents.length} recorded events.`,
      hypothesis: spec.hypothesis,
      casesAffected: affected.size,
      frequency: hitEvents.length,
      rate: Math.round((affected.size / caseCount) * 100),
      minutesPerCase: avgDuration,
      systems,
      departments,
      confidence,
      evidenceActions: [...new Set(hitEvents.map((event) => event.action))].slice(0, 4),
      intervention,
      rationale: reasoning.rationale,
      benefits: reasoning.benefits,
      risks: reasoning.risks,
      humanRole: reasoning.humanRole,
      alternatives: [{ type: reasoning.alternative, reason: `A viable secondary path, but ${intervention === "INTEGRATE" ? "does not remove the missing information flow as directly" : "may address the symptom without correcting the observed process pattern"}.` }, { type: "DO NOTHING", reason: "Keep as the baseline if validation finds the pattern is infrequent or risk exceeds expected benefit." }],
    })
  }
  if (!findings.length) {
    findings.push({
      id: "limited-signal", name: "No dominant repeated pattern detected", category: "EVIDENCE GAP", description: `The ${caseCount} cases do not yet show a high-frequency pattern from the configured rules.`, hypothesis: "The available event data may be incomplete or the work may be highly variable. This is an evidence gap, not confirmation that friction is absent.", casesAffected: 0, frequency: 0, rate: 0, systems: [], departments: [], confidence: "EARLY SIGNAL", evidenceActions: [], intervention: "DO NOTHING", rationale: rationaleByIntervention["DO NOTHING"].rationale, benefits: rationaleByIntervention["DO NOTHING"].benefits, risks: rationaleByIntervention["DO NOTHING"].risks, humanRole: rationaleByIntervention["DO NOTHING"].humanRole, alternatives: [],
    })
  }
  const workflow = [...actionMap.entries()].map(([action, value]) => {
    const lower = action.toLowerCase()
    const kind = /wait|pending|await|hold/.test(lower) ? "wait" : /contact|route|handoff|forward|assign|approval/.test(lower) ? "handoff" : /open|check customer|resolve|close request|close reconciliation/.test(lower) ? "expected" : "observed"
    const minutes = value.events.map((event) => event.duration_minutes ?? 0).reduce((sum, value) => sum + value, 0) / Math.max(value.cases.size, 1)
    return { action, count: value.events.length, systems: [...new Set(value.events.map((event) => event.system).filter((value): value is string => Boolean(value)))], cases: value.cases.size, minutes, kind }
  }).sort((a, b) => {
    const first = normalizedCaseValues[0]?.findIndex((event) => event.action === a.action) ?? 0
    const second = normalizedCaseValues[0]?.findIndex((event) => event.action === b.action) ?? 0
    return first - second
  }).slice(0, 10)
  const scenarioTitle = title ?? (scenario === "uploaded" ? "Uploaded investigation" : scenarioConfig[scenario].title)
  const summary = `${stats.rows.toLocaleString()} events reconstructed across ${stats.cases.toLocaleString()} cases. ${findings.length} evidence-backed pattern${findings.length === 1 ? "" : "s"} surfaced for investigation.`
  return { events, stats, findings, workflow, scenario, title: scenarioTitle, summary }
}

export const scenarioLabels: Record<ScenarioId, string> = { support: "Customer support", finance: "Finance operations", hr: "Human resources", uploaded: "Uploaded investigation" }

export function formatDate(value?: string) {
  if (!value) return "Not available"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export function getSampleAnalysis(scenario: Exclude<ScenarioId, "uploaded">) {
  return analyzeEvents(createSampleEvents(scenario), scenario)
}
