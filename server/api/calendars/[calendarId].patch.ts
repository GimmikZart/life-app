import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendars } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'
import { parseCalendarPayload } from '../../utils/calendar-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  await requireCalendarPermission(calendarId, currentUser.id, ['owner', 'editor'])

  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseCalendarPayload(body)
  const db = useDatabase()

  const [calendar] = await db
    .update(calendars)
    .set(payload)
    .where(eq(calendars.id, calendarId))
    .returning()

  return { calendar }
})
