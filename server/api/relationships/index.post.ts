import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { relationships, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseRelationshipPayload } from '../../utils/visibility-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const payload = parseRelationshipPayload(await readBody<Record<string, unknown>>(event))
  const db = useDatabase()

  const [targetUser] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, payload.targetEmail))
    .limit(1)

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'Target user not found.' })
  }

  if (targetUser.id === currentUser.id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot create a relationship with yourself.' })
  }

  const [relationship] = await db
    .insert(relationships)
    .values({
      userId: currentUser.id,
      targetUserId: targetUser.id,
      relationshipType: payload.relationshipType,
      visibilityRules: payload.visibilityRules
    })
    .onConflictDoUpdate({
      target: [relationships.userId, relationships.targetUserId],
      set: {
        relationshipType: payload.relationshipType,
        visibilityRules: payload.visibilityRules
      }
    })
    .returning()

  return {
    relationship: {
      ...relationship,
      targetEmail: targetUser.email,
      targetName: targetUser.name
    }
  }
})
