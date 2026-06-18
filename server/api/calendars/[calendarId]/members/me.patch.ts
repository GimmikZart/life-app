import { requireAuthenticatedUser } from '../../../../utils/auth'
import { getCalendarMembership } from '../../../../utils/calendar-access'
import { updateCalendarMemberStatus } from '../../../../utils/calendar-members'
import { parseMemberPatchPayload } from '../../../../utils/calendar-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseMemberPatchPayload(body)

  if (!payload.status || payload.permission) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only invite status updates are allowed on this endpoint.'
    })
  }

  const membership = await getCalendarMembership(calendarId, currentUser.id)

  if (!membership || membership.status !== 'pending') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only pending invites can be accepted or declined.'
    })
  }

  const member = await updateCalendarMemberStatus(calendarId, currentUser.id, payload.status)

  return { member }
})
