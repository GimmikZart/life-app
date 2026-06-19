import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarEvents, eventAssociations } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { requireCalendarPermission } from '../../../utils/calendar-access'

// Rimuove l'associazione evento-contatto (torna al display di default).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')
  const associatedUserId = getRouterParam(event, 'associatedUserId')

  if (!eventId || !associatedUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id and contact id are required.' })
  }

  const db = useDatabase()
  const [existingEvent] = await db
    .select({ calendarId: calendarEvents.calendarId })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1)

  if (!existingEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found.' })
  }

  await requireCalendarPermission(existingEvent.calendarId, currentUser.id, ['owner', 'editor'])

  await db
    .delete(eventAssociations)
    .where(and(
      eq(eventAssociations.eventId, eventId),
      eq(eventAssociations.associatedUserId, associatedUserId)
    ))

  return { ok: true }
})
