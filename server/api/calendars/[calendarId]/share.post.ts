import { eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendars } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { requireCalendarPermission } from '../../../utils/calendar-access'
import { getExternalConnectionForCalendar } from '../../../utils/external-calendar-sync'

// Genera (o restituisce) il link di condivisione pubblico del calendario. Solo owner.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  await requireCalendarPermission(calendarId, currentUser.id, ['owner'])

  const db = useDatabase()
  const externalConnection = await getExternalConnectionForCalendar(calendarId, currentUser.id)

  if (externalConnection) {
    throw createError({
      statusCode: 400,
      statusMessage: 'I calendari esterni non sono condivisibili: duplica gli eventi su un calendario Life App.'
    })
  }

  const [existing] = await db
    .select({ shareToken: calendars.shareToken })
    .from(calendars)
    .where(eq(calendars.id, calendarId))
    .limit(1)

  if (existing?.shareToken) {
    return { shareToken: existing.shareToken }
  }

  const shareToken = globalThis.crypto.randomUUID().replace(/-/g, '')
  await db.update(calendars).set({ shareToken }).where(eq(calendars.id, calendarId))

  return { shareToken }
})
