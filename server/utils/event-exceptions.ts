import { inArray } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { eventExceptions } from '../database/schema'
import type { EventException } from './calendar-recurrence'

// Carica le eccezioni delle occorrenze per un insieme di eventi e le indicizza
// per eventId, pronte per `expandCalendarEvents`.
export async function getExceptionsByEvent(eventIds: string[]): Promise<Map<string, EventException[]>> {
  const map = new Map<string, EventException[]>()

  if (!eventIds.length) {
    return map
  }

  const db = useDatabase()
  const rows = await db
    .select({
      eventId: eventExceptions.eventId,
      occurrenceDate: eventExceptions.occurrenceDate,
      isCancelled: eventExceptions.isCancelled,
      title: eventExceptions.title,
      category: eventExceptions.category,
      startAt: eventExceptions.startAt,
      endAt: eventExceptions.endAt,
      visibilityDefault: eventExceptions.visibilityDefault
    })
    .from(eventExceptions)
    .where(inArray(eventExceptions.eventId, eventIds))

  for (const row of rows) {
    const list = map.get(row.eventId) ?? []
    list.push({
      occurrenceDate: row.occurrenceDate.toISOString(),
      isCancelled: row.isCancelled,
      title: row.title,
      category: row.category,
      startAt: row.startAt?.toISOString() ?? null,
      endAt: row.endAt?.toISOString() ?? null,
      visibilityDefault: row.visibilityDefault
    })
    map.set(row.eventId, list)
  }

  return map
}
