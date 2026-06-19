import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { calendarMembers } from '../database/schema'

type CalendarPermission = 'owner' | 'editor' | 'viewer'

export async function getCalendarMembership(calendarId: string, userId: string) {
  const db = useDatabase()
  const [membership] = await db
    .select({
      calendarId: calendarMembers.calendarId,
      userId: calendarMembers.userId,
      permission: calendarMembers.permission,
      status: calendarMembers.status,
      isPrimary: calendarMembers.isPrimary,
      autoIntegrate: calendarMembers.autoIntegrate
    })
    .from(calendarMembers)
    .where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, userId)))
    .limit(1)

  return membership
}

export async function requireCalendarPermission(
  calendarId: string,
  userId: string,
  allowedPermissions: CalendarPermission[]
) {
  const membership = await getCalendarMembership(calendarId, userId)

  if (!membership || membership.status !== 'accepted' || !allowedPermissions.includes(membership.permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to manage this calendar.'
    })
  }

  return membership
}
