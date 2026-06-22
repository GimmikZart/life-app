import { and, eq, gt, inArray, lt, or } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import {
  calendarEvents,
  calendarMembers,
  calendars,
  eventVisibilityOverrides,
  relationships,
  users
} from '../database/schema'
import { requireAuthenticatedUser } from '../utils/auth'
import { parseDateRange } from '../utils/calendar-event-validation'
import { expandCalendarEvents, type CalendarEventForExpansion } from '../utils/calendar-recurrence'
import { getExceptionsByEvent } from '../utils/event-exceptions'
import { resolveEventVisibility } from '../utils/event-visibility'

// Restituisce la disponibilità "ufficiale" (primario + calendari integrati) di me
// + delle persone connesse richieste, risolta con le LORO regole di visibilità nei
// miei confronti. Serve sia a mostrare i calendari sovrapposti sia a calcolare gli
// slot liberi comuni (il calcolo degli slot avviene lato client, che conosce il fuso).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const query = getQuery(event)
  const { from, to } = parseDateRange(query)
  const db = useDatabase()

  // Utenti che mi espongono i loro eventi (connessione accettata nella direzione loro -> me).
  const incomingConnections = await db
    .select({
      ownerId: relationships.userId,
      visibilityRules: relationships.visibilityRules
    })
    .from(relationships)
    .where(and(
      eq(relationships.targetUserId, currentUser.id),
      eq(relationships.status, 'accepted')
    ))

  const allowedOwnerIds = new Set(incomingConnections.map((row) => row.ownerId))

  const requestedIds = typeof query.userIds === 'string' && query.userIds.trim()
    ? query.userIds.split(',').map((id) => id.trim()).filter(Boolean)
    : []

  // Includo sempre me + solo le persone con cui ho una connessione attiva.
  const participantIds = [
    currentUser.id,
    ...requestedIds.filter((id) => id !== currentUser.id && allowedOwnerIds.has(id))
  ]

  const participants = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, participantIds))

  // Insieme ufficiale di ciascun partecipante: calendari primario + auto-integrati.
  const officialMemberships = await db
    .select({ userId: calendarMembers.userId, calendarId: calendarMembers.calendarId })
    .from(calendarMembers)
    .where(and(
      inArray(calendarMembers.userId, participantIds),
      eq(calendarMembers.status, 'accepted'),
      or(eq(calendarMembers.isPrimary, true), eq(calendarMembers.autoIntegrate, true))
    ))

  const officialByUser = new Map<string, Set<string>>()
  for (const membership of officialMemberships) {
    const set = officialByUser.get(membership.userId) ?? new Set<string>()
    set.add(membership.calendarId)
    officialByUser.set(membership.userId, set)
  }

  const officialCalendarIds = [...new Set(officialMemberships.map((m) => m.calendarId))]

  if (!officialCalendarIds.length) {
    return { participants, occurrences: [] }
  }

  // Eventi nei calendari ufficiali dei partecipanti + eventi fissati manualmente.
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
      inArray(calendarEvents.userId, participantIds),
      inArray(calendarEvents.calendarId, officialCalendarIds),
      or(
        eq(calendarEvents.isRecurring, true),
        and(lt(calendarEvents.startAt, to), gt(calendarEvents.endAt, from))
      )
    ))

  // Tiene solo gli eventi che fanno parte della disponibilità ufficiale del proprietario.
  // La disponibilità di una persona = i suoi calendari integrati (il pin manuale e
  // relativo a CHI guarda, non incide sulla disponibilità altrui).
  const officialEvents = eventRows
    .filter((row) => officialByUser.get(row.userId)?.has(row.calendarId))
    .map((row) => ({ ...row, pinnedToPrimary: false }))

  // Regole di visibilità dei proprietari verso di me + override per singolo evento.
  const ownerIds = [...new Set(officialEvents.map((row) => row.userId))]
  const relationshipRows = incomingConnections
    .filter((row) => ownerIds.includes(row.ownerId))
    .map((row) => ({ userId: row.ownerId, targetUserId: currentUser.id, visibilityRules: row.visibilityRules }))
  const eventIds = officialEvents.map((row) => row.id)
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

  const exceptionsByEvent = await getExceptionsByEvent(officialEvents.map((row) => row.id))

  // Risolve la visibilità e espande le ricorrenze, attribuendo ogni occorrenza al proprietario.
  const occurrences = officialEvents.flatMap((row) => {
    const visible = resolveEventVisibility(row, currentUser.id, relationshipRows, overrideRows) as
      (CalendarEventForExpansion & { userId: string }) | null

    if (!visible) {
      return []
    }

    const busy = visible.visibilityDefault === 'busy'

    return expandCalendarEvents([visible], from, to, exceptionsByEvent).map((occurrence) => ({
      id: `${row.userId}:${occurrence.id}`,
      ownerUserId: row.userId,
      title: occurrence.title,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      busy
    }))
  })

  return { participants, occurrences }
})
