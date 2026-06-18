import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../../database/client'
import { calendarMembers } from '../../../../database/schema'
import { requireAuthenticatedUser } from '../../../../utils/auth'
import { requireCalendarPermission } from '../../../../utils/calendar-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')
  const targetUserId = getRouterParam(event, 'userId')

  if (!calendarId || !targetUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id and user id are required.' })
  }

  await requireCalendarPermission(calendarId, currentUser.id, ['owner'])

  if (targetUserId === currentUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Owners cannot remove themselves from their calendar.'
    })
  }

  const db = useDatabase()
  await db
    .delete(calendarMembers)
    .where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, targetUserId)))

  return { ok: true }
})
