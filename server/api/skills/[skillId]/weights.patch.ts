import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { skillWeights, skills } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { parseSkillWeightsPayload, requireOwnedSkill } from '../../../utils/skill-validation'

// Imposta i pesi delle sub-skill di una macro-skill. skillId = macro-skill.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const skillId = getRouterParam(event, 'skillId')

  if (!skillId) {
    throw createError({ statusCode: 400, statusMessage: 'Skill id is required.' })
  }

  await requireOwnedSkill(currentUser.id, skillId)
  const weights = parseSkillWeightsPayload(await readBody<Record<string, unknown>>(event))

  const db = useDatabase()
  const children = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.parentSkillId, skillId))

  const childIds = new Set(children.map((child) => child.id))
  const providedIds = new Set(weights.map((item) => item.childSkillId))

  // I pesi devono coprire esattamente le sub-skill della macro.
  if (childIds.size !== providedIds.size || [...childIds].some((id) => !providedIds.has(id))) {
    throw createError({ statusCode: 400, statusMessage: 'I pesi devono coprire esattamente le sub-skill della macro.' })
  }

  await db.transaction(async (tx) => {
    for (const item of weights) {
      await tx
        .update(skillWeights)
        .set({ weight: item.weight })
        .where(and(
          eq(skillWeights.parentSkillId, skillId),
          eq(skillWeights.childSkillId, item.childSkillId)
        ))
    }
  })

  return { ok: true }
})
