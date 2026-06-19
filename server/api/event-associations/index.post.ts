import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, eventAssociations, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'

// Associa un evento a un contatto specifico con colore/icona dedicati (2.6).
// Upsert: una sola associazione per coppia (evento, contatto).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  const associatedUserId = typeof body.associatedUserId === 'string' ? body.associatedUserId : ''
  const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null
  const icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : null

  if (!eventId || !associatedUserId) {
    throw createError({ statusCode: 400, statusMessage: 'eventId and associatedUserId are required.' })
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

  // Solo chi può modificare l'evento può associarvi un contatto.
  await requireCalendarPermission(existingEvent.calendarId, currentUser.id, ['owner', 'editor'])

  const [contact] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, associatedUserId))
    .limit(1)

  if (!contact) {
    throw createError({ statusCode: 404, statusMessage: 'Contact not found.' })
  }

  const [association] = await db
    .insert(eventAssociations)
    .values({ eventId, associatedUserId, displayConfig: { color, icon } })
    .onConflictDoUpdate({
      target: [eventAssociations.eventId, eventAssociations.associatedUserId],
      set: { displayConfig: { color, icon } }
    })
    .returning()

  return { association }
})
