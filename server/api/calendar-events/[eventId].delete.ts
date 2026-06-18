import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

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
  await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId))

  return { ok: true }
})
