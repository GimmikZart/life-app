import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { objectives } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const objectiveId = getRouterParam(event, 'objectiveId')

  if (!objectiveId) {
    throw createError({ statusCode: 400, statusMessage: 'Objective id is required.' })
  }

  const db = useDatabase()
  // I collegamenti event_objectives vengono rimossi a cascata (FK ON DELETE CASCADE).
  const [deleted] = await db
    .delete(objectives)
    .where(and(eq(objectives.id, objectiveId), eq(objectives.userId, currentUser.id)))
    .returning({ id: objectives.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Obiettivo non trovato.' })
  }

  return { ok: true }
})
