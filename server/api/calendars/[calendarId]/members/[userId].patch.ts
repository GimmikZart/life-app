import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../../database/client'
import { calendarMembers } from '../../../../database/schema'
import { requireAuthenticatedUser } from '../../../../utils/auth'
import { getCalendarMembership, requireCalendarPermission } from '../../../../utils/calendar-access'
import { updateCalendarMemberStatus } from '../../../../utils/calendar-members'
import { parseMemberPatchPayload } from '../../../../utils/calendar-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')
  const targetUserId = getRouterParam(event, 'userId')

  if (!calendarId || !targetUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id and user id are required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseMemberPatchPayload(body)
  const db = useDatabase()
  const nextStatus = payload.status

  const isSelfStatusChange = targetUserId === currentUser.id && nextStatus && !payload.permission

  if (isSelfStatusChange) {
    const membership = await getCalendarMembership(calendarId, currentUser.id)

    if (!membership || membership.status !== 'pending') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only pending invites can be accepted or declined.'
      })
    }

    const member = await updateCalendarMemberStatus(calendarId, currentUser.id, nextStatus)

    return { member }
  }

  await requireCalendarPermission(calendarId, currentUser.id, ['owner'])

  if (targetUserId === currentUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Owners cannot change their own membership from this endpoint.'
    })
  }

  const patch: Partial<typeof calendarMembers.$inferInsert> = {}

  if (payload.permission) {
    patch.permission = payload.permission
  }

  if (payload.status) {
    patch.status = payload.status
  }

  const [member] = await db
    .update(calendarMembers)
    .set(patch)
    .where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, targetUserId)))
    .returning()

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Calendar member not found.' })
  }

  return { member }
})
