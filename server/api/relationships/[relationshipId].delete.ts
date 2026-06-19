import { and, eq, or } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { relationships } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

// Rimuove una connessione. Cancella entrambe le direzioni (io -> altro e altro -> io)
// cosi la connessione sparisce per entrambi. Funziona anche per annullare una
// richiesta inviata (in quel caso la direzione reciproca non esiste ancora).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const relationshipId = getRouterParam(event, 'relationshipId')

  if (!relationshipId) {
    throw createError({ statusCode: 400, statusMessage: 'Relationship id is required.' })
  }

  const db = useDatabase()

  const [relationship] = await db
    .select({
      userId: relationships.userId,
      targetUserId: relationships.targetUserId
    })
    .from(relationships)
    .where(eq(relationships.id, relationshipId))
    .limit(1)

  // Posso eliminare solo una connessione che mi riguarda.
  if (!relationship || (relationship.userId !== currentUser.id && relationship.targetUserId !== currentUser.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Relationship not found.' })
  }

  const otherUserId = relationship.userId === currentUser.id
    ? relationship.targetUserId
    : relationship.userId

  await db
    .delete(relationships)
    .where(or(
      and(eq(relationships.userId, currentUser.id), eq(relationships.targetUserId, otherUserId)),
      and(eq(relationships.userId, otherUserId), eq(relationships.targetUserId, currentUser.id))
    ))

  return { ok: true }
})
