// Validazione e tipi dell'Action Engine (Sotto-Ciclo 3.2).
//
// La `frequency` e un oggetto JSON discriminato per `type`. Contiene gia ora
// `time` (HH:MM) e `durationMinutes`, che il Sotto-Ciclo 3.3 usera per
// materializzare gli eventi a calendario (start/end) corrispondenti alle
// occorrenze. La forma e volutamente esplicita per non dover refattorizzare il
// form quando 3.3 generera gli eventi.

export const actionWeights = [1, 2, 3] as const
export type ActionWeight = (typeof actionWeights)[number]

export const actionFrequencyTypes = ['daily', 'weekly', 'monthly', 'specific_date'] as const
export type ActionFrequencyType = (typeof actionFrequencyTypes)[number]

// Campi comuni a tutte le frequenze. `time` e l'orario (wall-clock) dell'occorrenza,
// `timeZone` e l'IANA timezone in cui interpretarlo (il Sotto-Ciclo 3.3 la usa per
// calcolare l'istante UTC esatto di ogni evento generato, gestendo il DST).
type ActionFrequencyBase = {
  time: string
  durationMinutes: number
  timeZone: string
}

// daysOfWeek: 0 = domenica ... 6 = sabato (convenzione JS Date.getDay).
// dayOfMonth: 1..31. date: 'YYYY-MM-DD'. time: 'HH:MM' (24h).
export type ActionFrequency =
  | (ActionFrequencyBase & { type: 'daily' })
  | (ActionFrequencyBase & { type: 'weekly'; daysOfWeek: number[] })
  | (ActionFrequencyBase & { type: 'monthly'; dayOfMonth: number })
  | (ActionFrequencyBase & { type: 'specific_date'; date: string })

export type ActionPayload = {
  name: string
  weight: ActionWeight
  frequency: ActionFrequency
  targetCalendarId: string | null
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DEFAULT_TIME_ZONE = 'Europe/Rome'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_TIME_ZONE
  }

  const candidate = value.trim()

  try {
    // Throws (RangeError) se la timezone IANA non e valida.
    new Intl.DateTimeFormat('en-US', { timeZone: candidate })
  } catch {
    badRequest('Fuso orario non valido.')
  }

  return candidate
}

function parseTime(value: unknown): string {
  if (typeof value === 'string' && TIME_RE.test(value.trim())) {
    return value.trim()
  }

  return badRequest('Orario non valido (atteso HH:MM).')
}

function parseDuration(value: unknown): number {
  const duration = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(duration) || duration < 1 || duration > 24 * 60) {
    badRequest('Durata non valida (minuti interi tra 1 e 1440).')
  }

  return duration
}

function parseFrequency(raw: unknown): ActionFrequency {
  if (!raw || typeof raw !== 'object') {
    badRequest('Frequenza mancante o non valida.')
  }

  const value = raw as Record<string, unknown>
  const type = value.type

  if (typeof type !== 'string' || !actionFrequencyTypes.includes(type as ActionFrequencyType)) {
    badRequest('Tipo di frequenza non valido.')
  }

  const base = {
    time: parseTime(value.time),
    durationMinutes: parseDuration(value.durationMinutes),
    timeZone: parseTimeZone(value.timeZone)
  }

  if (type === 'daily') {
    return { type: 'daily', ...base }
  }

  if (type === 'weekly') {
    const rawDays = Array.isArray(value.daysOfWeek) ? value.daysOfWeek : []
    const daysOfWeek = Array.from(new Set(
      rawDays.map((day) => (typeof day === 'number' ? day : Number(day)))
    ))

    if (!daysOfWeek.length || daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      badRequest('Seleziona almeno un giorno della settimana valido (0-6).')
    }

    return { type: 'weekly', daysOfWeek: daysOfWeek.sort((a, b) => a - b), ...base }
  }

  if (type === 'monthly') {
    const dayOfMonth = typeof value.dayOfMonth === 'number' ? value.dayOfMonth : Number(value.dayOfMonth)

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      badRequest('Giorno del mese non valido (1-31).')
    }

    return { type: 'monthly', dayOfMonth, ...base }
  }

  // specific_date
  const date = typeof value.date === 'string' ? value.date.trim() : ''

  if (!DATE_RE.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    badRequest('Data non valida (attesa YYYY-MM-DD).')
  }

  return { type: 'specific_date', date, ...base }
}

export function parseActionPayload(body: Record<string, unknown>): ActionPayload {
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    badRequest('Il nome della Action e obbligatorio.')
  }

  const weightValue = typeof body.weight === 'number' ? body.weight : Number(body.weight)

  if (!actionWeights.includes(weightValue as ActionWeight)) {
    badRequest('Peso non valido (atteso 1, 2 o 3).')
  }

  const frequency = parseFrequency(body.frequency)

  let targetCalendarId: string | null = null

  if (typeof body.targetCalendarId === 'string' && body.targetCalendarId.trim()) {
    const candidate = body.targetCalendarId.trim()

    if (!UUID_RE.test(candidate)) {
      badRequest('Calendario di destinazione non valido.')
    }

    targetCalendarId = candidate
  }

  return {
    name,
    weight: weightValue as ActionWeight,
    frequency,
    targetCalendarId
  }
}
