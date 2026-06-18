import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendars } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  await requireCalendarPermission(calendarId, currentUser.id, ['owner'])

  const db = useDatabase()
  await db.delete(calendars).where(eq(calendars.id, calendarId))

  return { ok: true }
})
