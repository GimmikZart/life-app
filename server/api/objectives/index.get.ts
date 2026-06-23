import { desc, eq, sql } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { eventObjectives, objectives } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()

  const rows = await db
    .select({
      id: objectives.id,
      title: objectives.title,
      description: objectives.description,
      targetDate: objectives.targetDate,
      createdAt: objectives.createdAt,
      eventCount: sql<number>`count(${eventObjectives.calendarEventId})::int`
    })
    .from(objectives)
    .leftJoin(eventObjectives, eq(eventObjectives.objectiveId, objectives.id))
    .where(eq(objectives.userId, currentUser.id))
    .groupBy(objectives.id)
    .orderBy(desc(objectives.createdAt))

  return { objectives: rows }
})
