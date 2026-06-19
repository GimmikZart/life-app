import { and, eq, gt, inArray, lt, or } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarEvents, calendarMembers, calendars, roomParticipants, users } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { parseDateRange } from '../../../utils/calendar-event-validation'
import { expandCalendarEvents, type CalendarEventForExpansion } from '../../../utils/calendar-recurrence'
import { getRoomByToken, getRoomParticipant, isRoomExpired } from '../../../utils/rooms'

// Disponibilità di tutti i partecipanti alla room. La visibilità (titolo vs
// "Occupato") dipende dalla scelta per-room di ciascun partecipante, NON dalle
// relazioni permanenti. Usa i calendari ufficiali (primario + auto-integrati).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Room token is required.' })
  }

  const { from, to } = parseDateRange(getQuery(event))
  const room = await getRoomByToken(token)

  if (!room) {
    throw createError({ statusCode: 404, statusMessage: 'Room not found.' })
  }

  if (isRoomExpired(room)) {
    throw createError({ statusCode: 403, statusMessage: 'This room has expired.' })
  }

  const myParticipant = await getRoomParticipant(room.id, currentUser.id)

  if (!myParticipant) {
    throw createError({ statusCode: 403, statusMessage: 'You are not in this room.' })
  }

  const db = useDatabase()
  const participants = await db
    .select({
      userId: roomParticipants.userId,
      visibility: roomParticipants.visibility,
      name: users.name,
      email: users.email
    })
    .from(roomParticipants)
    .innerJoin(users, eq(users.id, roomParticipants.userId))
    .where(eq(roomParticipants.roomId, room.id))

  const participantIds = participants.map((participant) => participant.userId)
  const visibilityByUser = new Map(participants.map((participant) => [participant.userId, participant.visibility]))

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

  const officialCalendarIds = [...new Set(officialMemberships.map((membership) => membership.calendarId))]

  const participantsOut = participants.map((participant) => ({
    id: participant.userId,
    name: participant.name,
    email: participant.email,
    visibility: participant.visibility
  }))

  if (!officialCalendarIds.length) {
    return { participants: participantsOut, occurrences: [] }
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
      inArray(calendarEvents.userId, participantIds),
      inArray(calendarEvents.calendarId, officialCalendarIds),
      or(
        eq(calendarEvents.isRecurring, true),
        and(lt(calendarEvents.startAt, to), gt(calendarEvents.endAt, from))
      )
    ))

  const officialEvents = eventRows.filter((row) => officialByUser.get(row.userId)?.has(row.calendarId))

  const occurrences = officialEvents.flatMap((row) => {
    const clear = (visibilityByUser.get(row.userId) ?? 'busy') === 'clear'
    const enriched: CalendarEventForExpansion = {
      ...row,
      title: clear ? row.title : 'Occupato',
      category: clear ? row.category : null,
      visibilityDefault: clear ? 'clear' : 'busy',
      pinnedToPrimary: false,
      association: null
    }

    return expandCalendarEvents([enriched], from, to).map((occurrence) => ({
      id: `${row.userId}:${occurrence.id}`,
      ownerUserId: row.userId,
      title: occurrence.title,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      busy: !clear
    }))
  })

  return { participants: participantsOut, occurrences }
})
