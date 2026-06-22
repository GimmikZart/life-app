import { and, desc, eq, ilike, inArray } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, calendarMembers, calendars } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

// Ricerca eventi per titolo tra i calendari a cui l'utente ha accesso (accettati).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const query = getQuery(event)
  const term = typeof query.q === 'string' ? query.q.trim() : ''

  if (term.length < 2) {
    return { events: [] }
  }

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
    return { events: [] }
  }

  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startAt: calendarEvents.startAt,
      calendarName: calendars.name
    })
    .from(calendarEvents)
    .innerJoin(calendars, eq(calendars.id, calendarEvents.calendarId))
    .where(and(
      inArray(calendarEvents.calendarId, calendarIds),
      ilike(calendarEvents.title, `%${term}%`)
    ))
    .orderBy(desc(calendarEvents.startAt))
    .limit(20)

  return {
    events: rows.map((row) => ({
      id: row.id,
      title: row.title,
      startAt: row.startAt.toISOString(),
      calendarName: row.calendarName
    }))
  }
})
