import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { relationships, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseVisibilityRules } from '../../utils/event-visibility'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()

  const rows = await db
    .select({
      id: relationships.id,
      userId: relationships.userId,
      targetUserId: relationships.targetUserId,
      targetEmail: users.email,
      targetName: users.name,
      relationshipType: relationships.relationshipType,
      visibilityRules: relationships.visibilityRules
    })
    .from(relationships)
    .innerJoin(users, eq(users.id, relationships.targetUserId))
    .where(eq(relationships.userId, currentUser.id))

  return {
    relationships: rows.map((row) => ({
      ...row,
      visibilityRules: parseVisibilityRules(row.visibilityRules)
    }))
  }
})
