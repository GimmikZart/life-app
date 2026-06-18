import { and, eq, gt, inArray, lt, or } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import {
  calendarEvents,
  calendarMembers,
  calendars,
  eventVisibilityOverrides,
  relationships
} from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseDateRange } from '../../utils/calendar-event-validation'
import { expandCalendarEvents } from '../../utils/calendar-recurrence'
import { resolveEventVisibility } from '../../utils/event-visibility'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const { from, to } = parseDateRange(getQuery(event))
  const db = useDatabase()

  const memberships = await db
    .select({ calendarId: calendarMembers.calendarId })
    .from(calendarMembers)
    .where(and(
      eq(calendarMembers.userId, currentUser.id),
      eq(calendarMembers.status, 'accepted')
    ))

  const calendarIds = memberships.map((membership) => membership.calendarId)

  if (!calendarIds.length) {
    return { events: [], occurrences: [] }
  }

  const eventRows = await db
    .select({
      id: calendarEvents.id,
      userId: calendarEvents.userId,
      title: calendarEvents.title,
      category: calendarEvents.category,
      calendarId: calendarEvents.calendarId,
      calendarName: calendars.name,
      calendarColor: calendars.color,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      isRecurring: calendarEvents.isRecurring,
      recurrenceRule: calendarEvents.recurrenceRule,
      visibilityDefault: calendarEvents.visibilityDefault
    })
    .from(calendarEvents)
    .innerJoin(calendars, eq(calendars.id, calendarEvents.calendarId))
    .where(and(
      inArray(calendarEvents.calendarId, calendarIds),
      or(
        eq(calendarEvents.isRecurring, true),
        and(lt(calendarEvents.startAt, to), gt(calendarEvents.endAt, from))
      )
    ))

  const eventOwnerIds = [...new Set(eventRows.map((row) => row.userId))]
  const eventIds = eventRows.map((row) => row.id)
  const relationshipRows = eventOwnerIds.length
    ? await db
        .select({
          userId: relationships.userId,
          targetUserId: relationships.targetUserId,
          visibilityRules: relationships.visibilityRules
        })
        .from(relationships)
        .where(and(
          inArray(relationships.userId, eventOwnerIds),
          eq(relationships.targetUserId, currentUser.id)
        ))
    : []
  const overrideRows = eventIds.length
    ? await db
        .select({
          eventId: eventVisibilityOverrides.eventId,
          targetUserId: eventVisibilityOverrides.targetUserId,
          visibility: eventVisibilityOverrides.visibility
        })
        .from(eventVisibilityOverrides)
        .where(and(
          inArray(eventVisibilityOverrides.eventId, eventIds),
          eq(eventVisibilityOverrides.targetUserId, currentUser.id)
        ))
    : []
  const visibleEventRows = eventRows
    .map((row) => resolveEventVisibility(row, currentUser.id, relationshipRows, overrideRows))
    .filter((row) => row !== null)

  return {
    events: visibleEventRows.map((row) => ({
      ...row,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString()
    })),
    occurrences: expandCalendarEvents(visibleEventRows, from, to)
  }
})
