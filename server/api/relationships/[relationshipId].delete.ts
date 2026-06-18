import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { relationships } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const relationshipId = getRouterParam(event, 'relationshipId')

  if (!relationshipId) {
    throw createError({ statusCode: 400, statusMessage: 'Relationship id is required.' })
  }

  const db = useDatabase()
  const [relationship] = await db
    .delete(relationships)
    .where(and(eq(relationships.id, relationshipId), eq(relationships.userId, currentUser.id)))
    .returning()

  if (!relationship) {
    throw createError({ statusCode: 404, statusMessage: 'Relationship not found.' })
  }

  return { ok: true }
})
