import { useDatabase } from '../../database/client'
import { eventSkills } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { assertOwnsEventAndSkill, parseEventSkillBody } from '../../utils/event-skill-access'

// Collega (o aggiorna i parametri di) una skill a un evento. Upsert sul unique
// (calendar_event_id, skill_id).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const payload = parseEventSkillBody(await readBody<Record<string, unknown>>(event))

  await assertOwnsEventAndSkill(currentUser.id, payload.calendarEventId, payload.skillId)

  const db = useDatabase()
  await db
    .insert(eventSkills)
    .values(payload)
    .onConflictDoUpdate({
      target: [eventSkills.calendarEventId, eventSkills.skillId],
      set: { contributionWeight: payload.contributionWeight, type: payload.type }
    })

  return { ok: true }
})
