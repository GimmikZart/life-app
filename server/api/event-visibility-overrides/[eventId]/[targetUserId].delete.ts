import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarEvents, eventVisibilityOverrides } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { requireCalendarPermission } from '../../../utils/calendar-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')
  const targetUserId = getRouterParam(event, 'targetUserId')

  if (!eventId || !targetUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id and target user id are required.' })
  }

  const db = useDatabase()
  const [calendarEvent] = await db
    .select({ calendarId: calendarEvents.calendarId })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1)

  if (!calendarEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found.' })
  }

  await requireCalendarPermission(calendarEvent.calendarId, currentUser.id, ['owner', 'editor'])

  const [override] = await db
    .delete(eventVisibilityOverrides)
    .where(and(
      eq(eventVisibilityOverrides.eventId, eventId),
      eq(eventVisibilityOverrides.targetUserId, targetUserId)
    ))
    .returning()

  if (!override) {
    throw createError({ statusCode: 404, statusMessage: 'Visibility override not found.' })
  }

  return { ok: true }
})
