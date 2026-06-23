import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { actionCompletions, calendarEvents, calendarMembers } from '../database/schema'
import type { ActionFrequency } from './action-validation'

// Orizzonte di generazione: gli eventi vengono materializzati per i prossimi
// ~4 mesi. La rigenerazione avviene a ogni create/update della Action. NB:
// estendere l'orizzonte mano a mano che si avvicina la fine richiedera un job
// schedulato (debito noto, come il cron del sync esterno) — qui non c'e ancora.
const HORIZON_DAYS = 120

type Database = ReturnType<typeof useDatabase>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type GeneratableAction = {
  id: string
  userId: string
  name: string
  frequency: ActionFrequency
  targetCalendarId: string | null
}

type GeneratedOccurrence = {
  occurrenceDate: string
  startAt: Date
  endAt: Date
}

// --- Timezone helpers (senza librerie: solo Intl) -------------------------

// Offset (ms) della timezone IANA rispetto a UTC nell'istante dato.
function zoneOffsetMs(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const parts: Record<string, string> = {}
  for (const part of dtf.formatToParts(instant)) {
    parts[part.type] = part.value
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )

  return asUtc - instant.getTime()
}

// Converte un orario "da parete" (wall-clock) in una timezone nell'istante UTC
// corrispondente, gestendo il DST tramite l'offset effettivo di quell'istante.
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offset = zoneOffsetMs(new Date(guess), timeZone)

  return new Date(guess - offset)
}

// Data del calendario (Y/M/D) per un istante in una timezone.
function dateInZone(instant: Date, timeZone: string) {
  const parts: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant)) {
    parts[part.type] = part.value
  }

  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }
}

function toYmd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Data dell'occorrenza ('YYYY-MM-DD') per un evento, nella timezone della Action.
// E la stessa data usata in generazione, quindi e la chiave corretta per
// action_completions.occurrence_date (Sotto-Ciclo 3.4).
export function occurrenceDateForInstant(instant: Date, timeZone: string) {
  const local = dateInZone(instant, timeZone)

  return toYmd(local.year, local.month, local.day)
}

// --- Calcolo occorrenze ----------------------------------------------------

function parseHm(time: string) {
  const [hour, minute] = time.split(':').map(Number)

  return { hour: hour ?? 0, minute: minute ?? 0 }
}

// Costruisce le occorrenze da oggi (nella timezone della Action) fino
// all'orizzonte, una per data pianificata. occurrenceDate = giorno locale.
export function computeOccurrences(frequency: ActionFrequency): GeneratableOccurrencesResult {
  const { hour, minute } = parseHm(frequency.time)
  const timeZone = frequency.timeZone
  const today = dateInZone(new Date(), timeZone)

  // Cursore su date-only in UTC per evitare derive da DST nel loop.
  const startMs = Date.UTC(today.year, today.month - 1, today.day)
  const endMs = startMs + HORIZON_DAYS * 86_400_000

  const occurrences: GeneratedOccurrence[] = []

  const push = (year: number, month: number, day: number) => {
    const startAt = zonedWallTimeToUtc(year, month, day, hour, minute, timeZone)
    occurrences.push({
      occurrenceDate: toYmd(year, month, day),
      startAt,
      endAt: new Date(startAt.getTime() + frequency.durationMinutes * 60_000)
    })
  }

  if (frequency.type === 'specific_date') {
    const [year, month, day] = frequency.date.split('-').map(Number)
    const dateMs = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)

    // Genera solo se da oggi in avanti (non si pianifica nel passato).
    if (year && month && day && dateMs >= startMs) {
      push(year, month, day)
    }

    return { boundary: new Date(startMs), occurrences }
  }

  for (let cursor = startMs; cursor <= endMs; cursor += 86_400_000) {
    const date = new Date(cursor)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1
    const day = date.getUTCDate()
    const dow = date.getUTCDay()

    if (frequency.type === 'daily') {
      push(year, month, day)
    } else if (frequency.type === 'weekly') {
      if (frequency.daysOfWeek.includes(dow)) {
        push(year, month, day)
      }
    } else if (frequency.type === 'monthly') {
      // Un giorno inesistente (es. 31 a febbraio) semplicemente non compare.
      if (day === frequency.dayOfMonth) {
        push(year, month, day)
      }
    }
  }

  return { boundary: new Date(startMs), occurrences }
}

type GeneratableOccurrencesResult = {
  // Inizio di "oggi" (UTC) usato come confine passato/futuro per la rigenerazione.
  boundary: Date
  occurrences: GeneratedOccurrence[]
}

// --- Persistenza -----------------------------------------------------------

async function getPrimaryCalendarId(tx: Transaction, userId: string) {
  const [primary] = await tx
    .select({ calendarId: calendarMembers.calendarId })
    .from(calendarMembers)
    .where(and(eq(calendarMembers.userId, userId), eq(calendarMembers.isPrimary, true)))
    .limit(1)

  return primary?.calendarId ?? null
}

async function getCompletedEventIds(tx: Transaction, actionId: string) {
  const rows = await tx
    .select({ calendarEventId: actionCompletions.calendarEventId })
    .from(actionCompletions)
    .where(and(eq(actionCompletions.actionId, actionId), isNotNull(actionCompletions.calendarEventId)))

  return new Set(rows.map((row) => row.calendarEventId).filter((id): id is string => Boolean(id)))
}

// Rimuove gli eventi futuri (>= boundary) generati da questa Action che NON
// sono stati completati. I completati restano (storia). Ritorna le date delle
// occorrenze gia coperte da un evento completato preservato.
async function removeRegenerableEvents(
  tx: Transaction,
  action: GeneratableAction,
  boundary: Date,
  timeZone: string
) {
  const completedEventIds = await getCompletedEventIds(tx, action.id)
  const existing = await tx
    .select({ id: calendarEvents.id, startAt: calendarEvents.startAt })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.actionId, action.id), gte(calendarEvents.startAt, boundary)))

  const idsToDelete: string[] = []
  const coveredDates = new Set<string>()

  for (const row of existing) {
    if (completedEventIds.has(row.id)) {
      const local = dateInZone(row.startAt, timeZone)
      coveredDates.add(toYmd(local.year, local.month, local.day))
    } else {
      idsToDelete.push(row.id)
    }
  }

  if (idsToDelete.length) {
    await tx.delete(calendarEvents).where(inArray(calendarEvents.id, idsToDelete))
  }

  return coveredDates
}

// Genera (rigenera) gli eventi calendario per una Action. Idempotente: cancella
// i futuri non completati e reinserisce le occorrenze mancanti, senza duplicare
// quelle gia completate. Da chiamare dentro la transazione di create/update.
export async function regenerateActionEvents(tx: Transaction, action: GeneratableAction) {
  const calendarId = action.targetCalendarId ?? (await getPrimaryCalendarId(tx, action.userId))

  if (!calendarId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nessun calendario di destinazione disponibile per la Action.'
    })
  }

  const { boundary, occurrences } = computeOccurrences(action.frequency)
  const coveredDates = await removeRegenerableEvents(tx, action, boundary, action.frequency.timeZone)

  const toInsert = occurrences.filter((occurrence) => !coveredDates.has(occurrence.occurrenceDate))

  if (!toInsert.length) {
    return { generated: 0, calendarId }
  }

  await tx.insert(calendarEvents).values(
    toInsert.map((occurrence) => ({
      userId: action.userId,
      calendarId,
      title: action.name,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      actionId: action.id,
      updatedAt: new Date()
    }))
  )

  return { generated: toInsert.length, calendarId }
}

// Elimina gli eventi futuri non completati generati da una Action (usato quando
// la Action viene eliminata). I completati e i passati restano come storico.
export async function removeFutureActionEvents(tx: Transaction, action: GeneratableAction) {
  const today = dateInZone(new Date(), action.frequency.timeZone)
  const boundary = new Date(Date.UTC(today.year, today.month - 1, today.day))

  await removeRegenerableEvents(tx, action, boundary, action.frequency.timeZone)
}
