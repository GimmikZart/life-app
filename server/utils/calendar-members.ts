import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { calendarMembers } from '../database/schema'
import type { MemberStatus } from './calendar-validation'

export async function updateCalendarMemberStatus(
  calendarId: string,
  userId: string,
  status: MemberStatus
) {
  const db = useDatabase()

  const [member] = await db
    .update(calendarMembers)
    .set({ status })
    .where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, userId)))
    .returning()

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Calendar member not found.' })
  }

  return member
}
