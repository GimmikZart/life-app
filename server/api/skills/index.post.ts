import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { skills } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseSkillPayload, redistributeSkillWeights } from '../../utils/skill-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const payload = parseSkillPayload(await readBody<Record<string, unknown>>(event))
  const db = useDatabase()

  if (payload.parentSkillId) {
    // Il parent dev'essere una macro-skill dell'utente (gerarchia a 2 livelli).
    const [parent] = await db
      .select({ id: skills.id, parentSkillId: skills.parentSkillId })
      .from(skills)
      .where(and(eq(skills.id, payload.parentSkillId), eq(skills.userId, currentUser.id)))
      .limit(1)

    if (!parent) {
      throw createError({ statusCode: 404, statusMessage: 'Macro-skill non trovata.' })
    }

    if (parent.parentSkillId) {
      throw createError({ statusCode: 400, statusMessage: 'Una sub-skill non puo avere altre sub-skill.' })
    }
  }

  const skill = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(skills)
      .values({
        userId: currentUser.id,
        name: payload.name,
        parentSkillId: payload.parentSkillId
      })
      .returning()

    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Impossibile creare la skill.' })
    }

    // Aggiungendo una sub-skill, ridistribuisci equamente i pesi dei fratelli.
    if (payload.parentSkillId) {
      await redistributeSkillWeights(tx, payload.parentSkillId)
    }

    return created
  })

  return { skill }
})
