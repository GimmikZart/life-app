import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, eventExceptions } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'
import { withRecurrenceUntil } from '../../utils/recurrence-scope'

// Eliminazione con scope:
// - 'all' (default): elimina l'intera serie/evento.
// - 'single': elimina solo l'occorrenza indicata (eccezione cancellata).
// - 'following': interrompe la serie a partire dall'occorrenza indicata (UNTIL).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

  const query = getQuery(event)
  const scope = query.scope === 'single' || query.scope === 'following' ? query.scope : 'all'
  const occurrence = typeof query.occurrence === 'string' ? new Date(query.occurrence) : null

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

  // Le eccezioni hanno senso solo su eventi ricorrenti con una data di occorrenza valida.
  const canScope = existingEvent.isRecurring && existingEvent.recurrenceRule && occurrence && !Number.isNaN(occurrence.getTime())

  if (scope === 'single' && canScope) {
    await db
      .insert(eventExceptions)
      .values({ eventId, occurrenceDate: occurrence as Date, isCancelled: true })
      .onConflictDoUpdate({
        target: [eventExceptions.eventId, eventExceptions.occurrenceDate],
        set: { isCancelled: true }
      })

    return { ok: true, scope: 'single' }
  }

  if (scope === 'following' && canScope) {
    // La serie termina appena prima dell'occorrenza selezionata.
    const until = new Date((occurrence as Date).getTime() - 1000)
    await db
      .update(calendarEvents)
      .set({ recurrenceRule: withRecurrenceUntil(existingEvent.recurrenceRule as string, until) })
      .where(eq(calendarEvents.id, eventId))

    return { ok: true, scope: 'following' }
  }

  await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId))

  return { ok: true, scope: 'all' }
})
