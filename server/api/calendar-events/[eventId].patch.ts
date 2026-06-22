import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, eventExceptions } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'
import { parseEventPayload } from '../../utils/calendar-event-validation'
import { withRecurrenceUntil } from '../../utils/recurrence-scope'

// Modifica con scope:
// - 'all' (default): aggiorna l'intera serie/evento.
// - 'single': override della sola occorrenza indicata (eccezione).
// - 'following': spezza la serie (tronca l'originale e ne crea una nuova dai campi modificati).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

  const query = getQuery(event)
  const scope = query.scope === 'single' || query.scope === 'following' ? query.scope : 'all'
  const occurrence = typeof query.occurrence === 'string' ? new Date(query.occurrence) : null
  const payload = parseEventPayload(await readBody<Record<string, unknown>>(event))

  const db = useDatabase()
  const [existingEvent] = await db
    .select({
      id: calendarEvents.id,
      calendarId: calendarEvents.calendarId,
      isRecurring: calendarEvents.isRecurring,
      recurrenceRule: calendarEvents.recurrenceRule
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1)

  if (!existingEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found.' })
  }

  await requireCalendarPermission(existingEvent.calendarId, currentUser.id, ['owner', 'editor'])

  const canScope = existingEvent.isRecurring && existingEvent.recurrenceRule && occurrence && !Number.isNaN(occurrence.getTime())

  // Override della singola occorrenza (non tocca la serie). Il calendario non
  // cambia per la singola occorrenza.
  if (scope === 'single' && canScope) {
    await db
      .insert(eventExceptions)
      .values({
        eventId,
        occurrenceDate: occurrence as Date,
        isCancelled: false,
        title: payload.title,
        category: payload.category,
        startAt: payload.startAt,
        endAt: payload.endAt,
        visibilityDefault: payload.visibilityDefault
      })
      .onConflictDoUpdate({
        target: [eventExceptions.eventId, eventExceptions.occurrenceDate],
        set: {
          isCancelled: false,
          title: payload.title,
          category: payload.category,
          startAt: payload.startAt,
          endAt: payload.endAt,
          visibilityDefault: payload.visibilityDefault
        }
      })

    return { event: { id: eventId } }
  }

  // Questa e le successive: tronca la serie originale e crea una nuova serie.
  if (scope === 'following' && canScope) {
    if (payload.calendarId !== existingEvent.calendarId) {
      await requireCalendarPermission(payload.calendarId, currentUser.id, ['owner', 'editor'])
    }

    const until = new Date((occurrence as Date).getTime() - 1000)

    const created = await db.transaction(async (tx) => {
      await tx
        .update(calendarEvents)
        .set({ recurrenceRule: withRecurrenceUntil(existingEvent.recurrenceRule as string, until) })
        .where(eq(calendarEvents.id, eventId))

      const [newEvent] = await tx
        .insert(calendarEvents)
        .values({
          userId: currentUser.id,
          calendarId: payload.calendarId,
          title: payload.title,
          category: payload.category,
          startAt: payload.startAt,
          endAt: payload.endAt,
          isRecurring: payload.isRecurring,
          recurrenceRule: payload.recurrenceRule,
          visibilityDefault: payload.visibilityDefault
        })
        .returning()

      return newEvent
    })

    return { event: created }
  }

  // Intera serie (default).
  if (payload.calendarId !== existingEvent.calendarId) {
    await requireCalendarPermission(payload.calendarId, currentUser.id, ['owner', 'editor'])
  }

  const [calendarEvent] = await db
    .update(calendarEvents)
    .set({
      calendarId: payload.calendarId,
      title: payload.title,
      category: payload.category,
      startAt: payload.startAt,
      endAt: payload.endAt,
      isRecurring: payload.isRecurring,
      recurrenceRule: payload.recurrenceRule,
      visibilityDefault: payload.visibilityDefault
    })
    .where(eq(calendarEvents.id, eventId))
    .returning()

  return { event: calendarEvent }
})
