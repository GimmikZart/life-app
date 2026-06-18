import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { relationships } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseRelationshipPatchPayload } from '../../utils/visibility-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const relationshipId = getRouterParam(event, 'relationshipId')

  if (!relationshipId) {
    throw createError({ statusCode: 400, statusMessage: 'Relationship id is required.' })
  }

  const payload = parseRelationshipPatchPayload(await readBody<Record<string, unknown>>(event))
  const patch: Partial<typeof relationships.$inferInsert> = {}

  if (payload.relationshipType !== null) {
    patch.relationshipType = payload.relationshipType
  }

  if (payload.visibilityRules !== null) {
    patch.visibilityRules = payload.visibilityRules
  }

  const db = useDatabase()
  const [relationship] = await db
    .update(relationships)
    .set(patch)
    .where(and(eq(relationships.id, relationshipId), eq(relationships.userId, currentUser.id)))
    .returning()

  if (!relationship) {
    throw createError({ statusCode: 404, statusMessage: 'Relationship not found.' })
  }

  return { relationship }
})
