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
import { expandCalendarEvents, type CalendarEventForExpansion } from '../../utils/calendar-recurrence'
import { resolveEventVisibility } from '../../utils/event-visibility'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const query = getQuery(event)
  const { from, to } = parseDateRange(query)
  // scope: 'mine' = solo eventi propri | 'official' = vista ufficiale
  // (calendari integrati + eventi fissati) | 'all' (default) = tutto il visibile.
  const scope = query.scope === 'mine' || query.scope === 'official' ? query.scope : 'all'
  // Filtro layer opzionale: lista di calendar id separati da virgola.
  const requestedCalendarIds = typeof query.calendarIds === 'string' && query.calendarIds.trim()
    ? query.calendarIds.split(',').map((id) => id.trim()).filter(Boolean)
    : null
  const db = useDatabase()

  const memberships = await db
    .select({
      calendarId: calendarMembers.calendarId,
      isPrimary: calendarMembers.isPrimary,
      autoIntegrate: calendarMembers.autoIntegrate
    })
    .from(calendarMembers)
    .where(and(
      eq(calendarMembers.userId, currentUser.id),
      eq(calendarMembers.status, 'accepted')
    ))

  const accessibleCalendarIds = memberships.map((membership) => membership.calendarId)
  // Insieme "ufficiale" dell'utente: calendari primario + auto-integrati.
  const officialCalendarIds = new Set(
    memberships
      .filter((membership) => membership.isPrimary || membership.autoIntegrate)
      .map((membership) => membership.calendarId)
  )

  // Applica l'eventuale filtro layer restando dentro i calendari accessibili.
  const calendarIds = requestedCalendarIds
    ? accessibleCalendarIds.filter((id) => requestedCalendarIds.includes(id))
    : accessibleCalendarIds

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
      visibilityDefault: calendarEvents.visibilityDefault,
      pinnedToPrimary: calendarEvents.pinnedToPrimary
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

  const scopedEventRows = eventRows.filter((row) => {
    if (scope === 'mine') {
      return row.userId === currentUser.id
    }

    if (scope === 'official') {
      // Vista ufficiale = eventi dei calendari integrati + eventi propri fissati.
      return officialCalendarIds.has(row.calendarId)
        || (row.userId === currentUser.id && row.pinnedToPrimary)
    }

    return true
  })

  const eventOwnerIds = [...new Set(scopedEventRows.map((row) => row.userId))]
  const eventIds = scopedEventRows.map((row) => row.id)
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
          eq(relationships.targetUserId, currentUser.id),
          eq(relationships.status, 'accepted')
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
  const visibleEventRows = scopedEventRows
    .map((row) =>
      resolveEventVisibility(row, currentUser.id, relationshipRows, overrideRows) as CalendarEventForExpansion | null
    )
    .filter((row): row is CalendarEventForExpansion => row !== null)

  return {
    events: visibleEventRows.map((row) => ({
      ...row,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString()
    })),
    occurrences: expandCalendarEvents(visibleEventRows, from, to)
  }
})
