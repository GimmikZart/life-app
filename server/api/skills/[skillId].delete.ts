import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { skills } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { redistributeSkillWeights } from '../../utils/skill-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const skillId = getRouterParam(event, 'skillId')

  if (!skillId) {
    throw createError({ statusCode: 400, statusMessage: 'Skill id is required.' })
  }

  const db = useDatabase()

  await db.transaction(async (tx) => {
    const [skill] = await tx
      .select({ id: skills.id, parentSkillId: skills.parentSkillId })
      .from(skills)
      .where(and(eq(skills.id, skillId), eq(skills.userId, currentUser.id)))
      .limit(1)

    if (!skill) {
      throw createError({ statusCode: 404, statusMessage: 'Skill non trovata.' })
    }

    // Le sub-skill e i pesi vengono rimossi a cascata (FK ON DELETE CASCADE).
    await tx.delete(skills).where(eq(skills.id, skillId))

    // Se era una sub-skill, ridistribuisci i pesi dei fratelli rimasti.
    if (skill.parentSkillId) {
      await redistributeSkillWeights(tx, skill.parentSkillId)
    }
  })

  return { ok: true }
})
