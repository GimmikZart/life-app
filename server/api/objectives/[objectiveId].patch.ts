import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { objectives } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseObjectivePayload } from '../../utils/objective-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const objectiveId = getRouterParam(event, 'objectiveId')

  if (!objectiveId) {
    throw createError({ statusCode: 400, statusMessage: 'Objective id is required.' })
  }

  const payload = parseObjectivePayload(await readBody<Record<string, unknown>>(event))
  const db = useDatabase()

  const [objective] = await db
    .update(objectives)
    .set({
      title: payload.title,
      description: payload.description,
      targetDate: payload.targetDate,
      updatedAt: new Date()
    })
    .where(and(eq(objectives.id, objectiveId), eq(objectives.userId, currentUser.id)))
    .returning()

  if (!objective) {
    throw createError({ statusCode: 404, statusMessage: 'Obiettivo non trovato.' })
  }

  return { objective }
})
