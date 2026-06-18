import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../../database/client'
import { calendarMembers, users } from '../../../../database/schema'
import { requireAuthenticatedUser } from '../../../../utils/auth'
import { requireCalendarPermission } from '../../../../utils/calendar-access'
import { parseInvitePayload } from '../../../../utils/calendar-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  await requireCalendarPermission(calendarId, currentUser.id, ['owner'])

  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseInvitePayload(body)
  const db = useDatabase()

  const [targetUser] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name
    })
    .from(users)
    .where(eq(users.email, payload.email))
    .limit(1)

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No registered user found with this email.'
    })
  }

  if (targetUser.id === currentUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You are already the owner of this calendar.'
    })
  }

  const [member] = await db
    .insert(calendarMembers)
    .values({
      calendarId,
      userId: targetUser.id,
      permission: payload.permission,
      status: 'pending'
    })
    .onConflictDoUpdate({
      target: [calendarMembers.calendarId, calendarMembers.userId],
      set: {
        permission: payload.permission,
        status: 'pending'
      }
    })
    .returning()

  const [memberWithUser] = await db
    .select({
      calendarId: calendarMembers.calendarId,
      userId: calendarMembers.userId,
      permission: calendarMembers.permission,
      status: calendarMembers.status,
      email: users.email,
      name: users.name
    })
    .from(calendarMembers)
    .innerJoin(users, eq(users.id, calendarMembers.userId))
    .where(and(eq(calendarMembers.calendarId, member.calendarId), eq(calendarMembers.userId, member.userId)))
    .limit(1)

  return {
    member: memberWithUser
  }
})
