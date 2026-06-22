import { and, eq, gt, inArray, lt, or } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import {
  calendarEvents,
  calendarMembers,
  calendars,
  eventAssociations,
  eventOfficialPins,
  eventVisibilityOverrides,
  relationships,
  users
} from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseDateRange } from '../../utils/calendar-event-validation'
import { expandCalendarEvents, type CalendarEventForExpansion } from '../../utils/calendar-recurrence'
import { getExceptionsByEvent } from '../../utils/event-exceptions'
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

  // Pin per-utente: quali di questi eventi ho fissato nella MIA vista ufficiale.
  const fetchedEventIds = eventRows.map((row) => row.id)
  const pinRows = fetchedEventIds.length
    ? await db
        .select({ eventId: eventOfficialPins.eventId })
        .from(eventOfficialPins)
        .where(and(
          eq(eventOfficialPins.userId, currentUser.id),
          inArray(eventOfficialPins.eventId, fetchedEventIds)
        ))
    : []
  const myPinnedEventIds = new Set(pinRows.map((row) => row.eventId))

  // `pinnedToPrimary` qui significa "fissato da me" (relativo all'utente corrente).
  const eventRowsWithPin = eventRows.map((row) => ({
    ...row,
    pinnedToPrimary: myPinnedEventIds.has(row.id)
  }))

  const scopedEventRows = eventRowsWithPin.filter((row) => {
    if (scope === 'mine') {
      return row.userId === currentUser.id
    }

    if (scope === 'official') {
      // Vista ufficiale = eventi dei calendari integrati + eventi fissati da me.
      return officialCalendarIds.has(row.calendarId) || row.pinnedToPrimary
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
  // Associazioni evento-contatto (colore/icona) per gli eventi visibili.
  const associationRows = eventIds.length
    ? await db
        .select({
          eventId: eventAssociations.eventId,
          associatedUserId: eventAssociations.associatedUserId,
          displayConfig: eventAssociations.displayConfig,
          name: users.name
        })
        .from(eventAssociations)
        .innerJoin(users, eq(users.id, eventAssociations.associatedUserId))
        .where(inArray(eventAssociations.eventId, eventIds))
    : []
  const associationByEvent = new Map(associationRows.map((row) => [row.eventId, row]))

  const visibleEventRows: CalendarEventForExpansion[] = []
  for (const row of scopedEventRows) {
    const visible = resolveEventVisibility(row, currentUser.id, relationshipRows, overrideRows) as CalendarEventForExpansion | null

    if (!visible) {
      continue
    }

    // L'associazione si mostra solo sugli eventi in chiaro (non rivela "con chi" se occupato).
    const association = visible.visibilityDefault === 'clear'
      ? associationByEvent.get(visible.id)
      : undefined

    visibleEventRows.push({
      ...visible,
      association: association
        ? {
            userId: association.associatedUserId,
            name: association.name,
            color: typeof association.displayConfig?.color === 'string' ? association.displayConfig.color : null,
            icon: typeof association.displayConfig?.icon === 'string' ? association.displayConfig.icon : null
          }
        : null
    })
  }

  const exceptionsByEvent = await getExceptionsByEvent(visibleEventRows.map((row) => row.id))

  return {
    events: visibleEventRows.map((row) => ({
      ...row,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString()
    })),
    occurrences: expandCalendarEvents(visibleEventRows, from, to, exceptionsByEvent)
  }
})
