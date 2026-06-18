import { and, eq, gt, inArray, lt, or } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, calendarMembers, calendars } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseDateRange } from '../../utils/calendar-event-validation'
import { expandCalendarEvents } from '../../utils/calendar-recurrence'

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

  return {
    events: eventRows.map((row) => ({
      ...row,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString()
    })),
    occurrences: expandCalendarEvents(eventRows, from, to)
  }
})
