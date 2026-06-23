import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { eventObjectives } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { assertOwnsEventAndObjective, parseEventObjectiveBody } from '../../utils/event-objective-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const { calendarEventId, objectiveId } = parseEventObjectiveBody(await readBody<Record<string, unknown>>(event))

  await assertOwnsEventAndObjective(currentUser.id, calendarEventId, objectiveId)

  const db = useDatabase()
  await db
    .delete(eventObjectives)
    .where(and(
      eq(eventObjectives.calendarEventId, calendarEventId),
      eq(eventObjectives.objectiveId, objectiveId)
    ))

  return { ok: true }
})
