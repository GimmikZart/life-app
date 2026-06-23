import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { calendarEvents, objectives } from '../database/schema'

// Un collegamento evento<->obiettivo e ammesso solo se l'utente possiede ENTRAMBI
// (coerente con le RLS). Lancia 404 se uno dei due non e suo.
export async function assertOwnsEventAndObjective(
  userId: string,
  calendarEventId: string,
  objectiveId: string
) {
  const db = useDatabase()

  const [ownedEvent] = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, calendarEventId), eq(calendarEvents.userId, userId)))
    .limit(1)

  if (!ownedEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato.' })
  }

  const [ownedObjective] = await db
    .select({ id: objectives.id })
    .from(objectives)
    .where(and(eq(objectives.id, objectiveId), eq(objectives.userId, userId)))
    .limit(1)

  if (!ownedObjective) {
    throw createError({ statusCode: 404, statusMessage: 'Obiettivo non trovato.' })
  }
}

export function parseEventObjectiveBody(body: Record<string, unknown>) {
  const calendarEventId = typeof body.calendarEventId === 'string' ? body.calendarEventId.trim() : ''
  const objectiveId = typeof body.objectiveId === 'string' ? body.objectiveId.trim() : ''

  if (!calendarEventId || !objectiveId) {
    throw createError({ statusCode: 400, statusMessage: 'calendarEventId e objectiveId sono obbligatori.' })
  }

  return { calendarEventId, objectiveId }
}
