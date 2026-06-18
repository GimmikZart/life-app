import { and, eq, inArray } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import {
  calendarEvents,
  calendarMembers,
  eventVisibilityOverrides,
  users
} from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()

  const manageableCalendars = await db
    .select({ calendarId: calendarMembers.calendarId })
    .from(calendarMembers)
    .where(and(
      eq(calendarMembers.userId, currentUser.id),
      eq(calendarMembers.status, 'accepted'),
      inArray(calendarMembers.permission, ['owner', 'editor'])
    ))
  const calendarIds = manageableCalendars.map((membership) => membership.calendarId)

  if (!calendarIds.length) {
    return { overrides: [] }
  }

  const eventRows = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(inArray(calendarEvents.calendarId, calendarIds))
  const eventIds = eventRows.map((row) => row.id)

  if (!eventIds.length) {
    return { overrides: [] }
  }

  const rows = await db
    .select({
      eventId: eventVisibilityOverrides.eventId,
      targetUserId: eventVisibilityOverrides.targetUserId,
      targetEmail: users.email,
      targetName: users.name,
      visibility: eventVisibilityOverrides.visibility
    })
    .from(eventVisibilityOverrides)
    .innerJoin(users, eq(users.id, eventVisibilityOverrides.targetUserId))
    .where(inArray(eventVisibilityOverrides.eventId, eventIds))

  return { overrides: rows }
})
