import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { eventSkills } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { assertOwnsEventAndSkill } from '../../utils/event-skill-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  const calendarEventId = typeof body.calendarEventId === 'string' ? body.calendarEventId.trim() : ''
  const skillId = typeof body.skillId === 'string' ? body.skillId.trim() : ''

  if (!calendarEventId || !skillId) {
    throw createError({ statusCode: 400, statusMessage: 'calendarEventId e skillId sono obbligatori.' })
  }

  await assertOwnsEventAndSkill(currentUser.id, calendarEventId, skillId)

  const db = useDatabase()
  await db
    .delete(eventSkills)
    .where(and(
      eq(eventSkills.calendarEventId, calendarEventId),
      eq(eventSkills.skillId, skillId)
    ))

  return { ok: true }
})
