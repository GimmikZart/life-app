import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarEvents, calendarMembers } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { requireCalendarPermission } from '../../../utils/calendar-access'

// Sposta un evento nel calendario principale dell'utente (cambia calendarId).
// Richiede di poter modificare l'evento (owner/editor del calendario sorgente).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
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

  const [primary] = await db
    .select({ calendarId: calendarMembers.calendarId })
    .from(calendarMembers)
    .where(and(
      eq(calendarMembers.userId, currentUser.id),
      eq(calendarMembers.isPrimary, true)
    ))
    .limit(1)

  if (!primary) {
    throw createError({ statusCode: 400, statusMessage: 'Nessun calendario principale.' })
  }

  if (primary.calendarId === existingEvent.calendarId) {
    return { calendarId: primary.calendarId }
  }

  await db
    .update(calendarEvents)
    .set({ calendarId: primary.calendarId })
    .where(eq(calendarEvents.id, eventId))

  return { calendarId: primary.calendarId }
})
