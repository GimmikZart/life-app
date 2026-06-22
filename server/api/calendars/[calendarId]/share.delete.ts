import { eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendars } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { requireCalendarPermission } from '../../../utils/calendar-access'

// Revoca il link di condivisione pubblico (chi lo ha già non perde l'accesso). Solo owner.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  await requireCalendarPermission(calendarId, currentUser.id, ['owner'])

  const db = useDatabase()
  await db.update(calendars).set({ shareToken: null }).where(eq(calendars.id, calendarId))

  return { ok: true }
})
