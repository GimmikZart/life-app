import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarEvents, eventOfficialPins } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { getCalendarMembership } from '../../../utils/calendar-access'

// Integrazione manuale PER-UTENTE: fissa/sgancia un evento dalla MIA vista ufficiale.
// Posso fissare qualsiasi evento che ho il diritto di vedere (sono membro accettato
// del suo calendario), anche se l'evento e di un altro (calendario condiviso/pubblico).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)

  if (typeof body.pinnedToPrimary !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'pinnedToPrimary must be a boolean.' })
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

  // Devo poter vedere l'evento: membro accettato del calendario che lo contiene.
  const membership = await getCalendarMembership(existingEvent.calendarId, currentUser.id)

  if (!membership || membership.status !== 'accepted') {
    throw createError({ statusCode: 403, statusMessage: 'You cannot access this event.' })
  }

  if (body.pinnedToPrimary) {
    await db
      .insert(eventOfficialPins)
      .values({ eventId, userId: currentUser.id })
      .onConflictDoNothing()
  } else {
    await db
      .delete(eventOfficialPins)
      .where(and(
        eq(eventOfficialPins.eventId, eventId),
        eq(eventOfficialPins.userId, currentUser.id)
      ))
  }

  return { pinnedToPrimary: body.pinnedToPrimary }
})
