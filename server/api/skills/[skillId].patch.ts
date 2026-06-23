import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { skills } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseSkillPayload } from '../../utils/skill-validation'

// Rinomina una skill. La modifica di gerarchia/peso passa da altri endpoint.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const skillId = getRouterParam(event, 'skillId')

  if (!skillId) {
    throw createError({ statusCode: 400, statusMessage: 'Skill id is required.' })
  }

  const payload = parseSkillPayload(await readBody<Record<string, unknown>>(event))
  const db = useDatabase()

  const [skill] = await db
    .update(skills)
    .set({ name: payload.name, updatedAt: new Date() })
    .where(and(eq(skills.id, skillId), eq(skills.userId, currentUser.id)))
    .returning()

  if (!skill) {
    throw createError({ statusCode: 404, statusMessage: 'Skill non trovata.' })
  }

  return { skill }
})
