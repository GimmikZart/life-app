import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, eventExceptions } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'
import { parseEventPayload } from '../../utils/calendar-event-validation'
import {
  buildExternalEventValuesForCalendar,
  enqueueExternalDelete,
  enqueueExternalEventSync,
  getExternalConnectionForCalendar
} from '../../utils/external-calendar-sync'
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
      userId: calendarEvents.userId,
      calendarId: calendarEvents.calendarId,
      title: calendarEvents.title,
      category: calendarEvents.category,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      isRecurring: calendarEvents.isRecurring,
      recurrenceRule: calendarEvents.recurrenceRule,
      source: calendarEvents.source,
      externalConnectionId: calendarEvents.externalConnectionId,
      externalCalendarId: calendarEvents.externalCalendarId,
      externalId: calendarEvents.externalId
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
    if (existingEvent.externalConnectionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le modifiche a una singola occorrenza di un calendario esterno non sono ancora sincronizzabili: modifica tutta la serie.'
      })
    }

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
    if (existingEvent.externalConnectionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le modifiche "questo e i successivi" sui calendari esterni non sono ancora sincronizzabili: modifica tutta la serie.'
      })
    }

    if (payload.calendarId !== existingEvent.calendarId) {
      await requireCalendarPermission(payload.calendarId, currentUser.id, ['owner', 'editor'])
    }

    const until = new Date((occurrence as Date).getTime() - 1000)
    const targetExternalConnection = await getExternalConnectionForCalendar(payload.calendarId, currentUser.id)

    const created = await db.transaction(async (tx) => {
      await tx
        .update(calendarEvents)
        .set({ recurrenceRule: withRecurrenceUntil(existingEvent.recurrenceRule as string, until), updatedAt: new Date() })
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
          visibilityDefault: payload.visibilityDefault,
          ...buildExternalEventValuesForCalendar(targetExternalConnection),
          updatedAt: new Date()
        })
        .returning()

      if (!newEvent) {
        throw createError({ statusCode: 500, statusMessage: 'Unable to create event.' })
      }

      return newEvent
    })

    if (targetExternalConnection) {
      await enqueueExternalEventSync(created.id, 'create')
    }

    return { event: created }
  }

  // Intera serie (default).
  if (payload.calendarId !== existingEvent.calendarId) {
    await requireCalendarPermission(payload.calendarId, currentUser.id, ['owner', 'editor'])
  }

  const targetExternalConnection = await getExternalConnectionForCalendar(payload.calendarId, currentUser.id)
  const movedBetweenProviders = existingEvent.externalConnectionId
    && existingEvent.externalConnectionId !== targetExternalConnection?.id

  if (movedBetweenProviders) {
    await enqueueExternalDelete(existingEvent)
  }

  const externalValues = buildExternalEventValuesForCalendar(
    targetExternalConnection,
    existingEvent.externalConnectionId === targetExternalConnection?.id ? existingEvent.externalId : null
  )
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
      visibilityDefault: payload.visibilityDefault,
      ...externalValues,
      updatedAt: new Date()
    })
    .where(eq(calendarEvents.id, eventId))
    .returning()

  if (!calendarEvent) {
    throw createError({ statusCode: 500, statusMessage: 'Unable to update event.' })
  }

  if (targetExternalConnection) {
    await enqueueExternalEventSync(calendarEvent.id, calendarEvent.externalId ? 'update' : 'create')
  }

  return { event: calendarEvent }
})
