import { eq, inArray } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { skillWeights, skills } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

// Ritorna le skill in forma gerarchica: macro-skill (parent null) con le loro
// sub-skill e il peso di ciascuna.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()

  const rows = await db
    .select({
      id: skills.id,
      name: skills.name,
      parentSkillId: skills.parentSkillId,
      decayCoefficient: skills.decayCoefficient,
      createdAt: skills.createdAt
    })
    .from(skills)
    .where(eq(skills.userId, currentUser.id))
    .orderBy(skills.createdAt)

  const macroIds = rows.filter((row) => !row.parentSkillId).map((row) => row.id)
  const weightRows = macroIds.length
    ? await db
        .select({
          parentSkillId: skillWeights.parentSkillId,
          childSkillId: skillWeights.childSkillId,
          weight: skillWeights.weight
        })
        .from(skillWeights)
        .where(inArray(skillWeights.parentSkillId, macroIds))
    : []

  const weightByChild = new Map(weightRows.map((row) => [row.childSkillId, row.weight]))

  const macros = rows
    .filter((row) => !row.parentSkillId)
    .map((macro) => ({
      id: macro.id,
      name: macro.name,
      decayCoefficient: macro.decayCoefficient,
      subs: rows
        .filter((row) => row.parentSkillId === macro.id)
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          weight: weightByChild.get(sub.id) ?? 0
        }))
    }))

  return { skills: macros }
})
