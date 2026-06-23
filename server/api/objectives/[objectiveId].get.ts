import { and, between, eq, inArray } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import {
  calendarEvents,
  calendars,
  eventCompletions,
  eventObjectives,
  objectives
} from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { expandCalendarEvents, type CalendarEventForExpansion } from '../../utils/calendar-recurrence'
import { getExceptionsByEvent } from '../../utils/event-exceptions'

const PROGRESS_WINDOW_DAYS = 30

function ymd(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const objectiveId = getRouterParam(event, 'objectiveId')

  if (!objectiveId) {
    throw createError({ statusCode: 400, statusMessage: 'Objective id is required.' })
  }

  const db = useDatabase()
  const [objective] = await db
    .select()
    .from(objectives)
    .where(and(eq(objectives.id, objectiveId), eq(objectives.userId, currentUser.id)))
    .limit(1)

  if (!objective) {
    throw createError({ statusCode: 404, statusMessage: 'Obiettivo non trovato.' })
  }

  // Eventi (Action) collegati a questo obiettivo.
  const linkedRows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      category: calendarEvents.category,
      calendarId: calendarEvents.calendarId,
      calendarName: calendars.name,
      calendarColor: calendars.color,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      isRecurring: calendarEvents.isRecurring,
      recurrenceRule: calendarEvents.recurrenceRule,
      visibilityDefault: calendarEvents.visibilityDefault
    })
    .from(eventObjectives)
    .innerJoin(calendarEvents, eq(calendarEvents.id, eventObjectives.calendarEventId))
    .innerJoin(calendars, eq(calendars.id, calendarEvents.calendarId))
    .where(eq(eventObjectives.objectiveId, objectiveId))

  // Progresso: % di occorrenze pianificate completate negli ultimi 30 giorni.
  // (I completamenti arrivano nel Sotto-Ciclo 4.4; finche non esistono il
  //  progresso e 0%, ma il calcolo e gia corretto.)
  const now = new Date()
  const from = new Date(now.getTime() - PROGRESS_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  let planned = 0
  let completed = 0

  if (linkedRows.length) {
    const eventIds = linkedRows.map((row) => row.id)
    const exceptionsByEvent = await getExceptionsByEvent(eventIds)
    const forExpansion: CalendarEventForExpansion[] = linkedRows.map((row) => ({
      ...row,
      pinnedToPrimary: false
    }))
    planned = expandCalendarEvents(forExpansion, from, now, exceptionsByEvent).length

    const completionRows = await db
      .select({ id: eventCompletions.id })
      .from(eventCompletions)
      .where(and(
        eq(eventCompletions.userId, currentUser.id),
        inArray(eventCompletions.calendarEventId, eventIds),
        between(eventCompletions.occurrenceDate, ymd(from), ymd(now))
      ))
    completed = completionRows.length
  }

  const percent = planned > 0 ? Math.round((completed / planned) * 100) : 0

  return {
    objective,
    events: linkedRows.map((row) => ({
      id: row.id,
      title: row.title,
      startAt: row.startAt.toISOString(),
      isRecurring: row.isRecurring,
      calendarName: row.calendarName,
      calendarColor: row.calendarColor
    })),
    progress: { completed, planned, percent, windowDays: PROGRESS_WINDOW_DAYS }
  }
})
