import { eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarMembers, calendars } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'

// Unisce l'utente corrente a un calendario tramite token di condivisione pubblico,
// come viewer. Idempotente: se è già membro (in qualsiasi ruolo) non lo declassa.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Share token is required.' })
  }

  const db = useDatabase()
  const [calendar] = await db
    .select({ id: calendars.id, name: calendars.name })
    .from(calendars)
    .where(eq(calendars.shareToken, token))
    .limit(1)

  if (!calendar) {
    throw createError({ statusCode: 404, statusMessage: 'Link non valido o revocato.' })
  }

  await db
    .insert(calendarMembers)
    .values({ calendarId: calendar.id, userId: currentUser.id, permission: 'viewer', status: 'accepted' })
    .onConflictDoNothing()

  return { calendarId: calendar.id, name: calendar.name }
})
