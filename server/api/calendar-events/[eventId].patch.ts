import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'
import { parseEventPayload } from '../../utils/calendar-event-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

  const payload = parseEventPayload(await readBody<Record<string, unknown>>(event))
  const db = useDatabase()
  const [existingEvent] = await db
    .select({
      id: calendarEvents.id,
      calendarId: calendarEvents.calendarId
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1)

  if (!existingEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found.' })
  }

  await requireCalendarPermission(existingEvent.calendarId, currentUser.id, ['owner', 'editor'])

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
      visibilityDefault: payload.visibilityDefault,
      pinnedToPrimary: payload.pinnedToPrimary
    })
    .where(eq(calendarEvents.id, eventId))
    .returning()

  return {
    event: calendarEvent
  }
})
