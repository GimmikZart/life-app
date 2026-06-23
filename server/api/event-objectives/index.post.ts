import { useDatabase } from '../../database/client'
import { eventObjectives } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { assertOwnsEventAndObjective, parseEventObjectiveBody } from '../../utils/event-objective-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const { calendarEventId, objectiveId } = parseEventObjectiveBody(await readBody<Record<string, unknown>>(event))

  await assertOwnsEventAndObjective(currentUser.id, calendarEventId, objectiveId)

  const db = useDatabase()
  // Idempotente: il unique (calendar_event_id, objective_id) protegge dai doppioni.
  await db
    .insert(eventObjectives)
    .values({ calendarEventId, objectiveId })
    .onConflictDoNothing()

  return { ok: true }
})
