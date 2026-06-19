import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { relationships, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseVisibilityRules } from '../../utils/event-visibility'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()

  // Connessioni attive: la mia riga (io -> altro) accettata. Contiene le regole
  // di visibilita che IO applico verso quella persona.
  const connectionRows = await db
    .select({
      id: relationships.id,
      targetUserId: relationships.targetUserId,
      targetEmail: users.email,
      targetName: users.name,
      relationshipType: relationships.relationshipType,
      visibilityRules: relationships.visibilityRules
    })
    .from(relationships)
    .innerJoin(users, eq(users.id, relationships.targetUserId))
    .where(and(
      eq(relationships.userId, currentUser.id),
      eq(relationships.status, 'accepted')
    ))

  // Richieste ricevute: qualcuno ha invitato me ed e in attesa di risposta.
  const incomingRows = await db
    .select({
      id: relationships.id,
      requesterUserId: relationships.userId,
      requesterEmail: users.email,
      requesterName: users.name,
      relationshipType: relationships.relationshipType
    })
    .from(relationships)
    .innerJoin(users, eq(users.id, relationships.userId))
    .where(and(
      eq(relationships.targetUserId, currentUser.id),
      eq(relationships.status, 'pending')
    ))

  // Richieste inviate: ho invitato qualcuno e attendo la sua risposta.
  const outgoingRows = await db
    .select({
      id: relationships.id,
      targetUserId: relationships.targetUserId,
      targetEmail: users.email,
      targetName: users.name,
      relationshipType: relationships.relationshipType
    })
    .from(relationships)
    .innerJoin(users, eq(users.id, relationships.targetUserId))
    .where(and(
      eq(relationships.userId, currentUser.id),
      eq(relationships.status, 'pending')
    ))

  return {
    connections: connectionRows.map((row) => ({
      ...row,
      visibilityRules: parseVisibilityRules(row.visibilityRules)
    })),
    incomingRequests: incomingRows,
    outgoingRequests: outgoingRows
  }
})
