import { eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { relationships } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'

// Risponde a una richiesta di connessione ricevuta (accetta o rifiuta).
// Accettando si crea la riga reciproca (io -> richiedente) con default privacy 'busy',
// rendendo la connessione attiva in entrambe le direzioni.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const relationshipId = getRouterParam(event, 'relationshipId')

  if (!relationshipId) {
    throw createError({ statusCode: 400, statusMessage: 'Relationship id is required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const action = body.action === 'accept' || body.action === 'decline' ? body.action : null

  if (!action) {
    throw createError({ statusCode: 400, statusMessage: 'Action must be accept or decline.' })
  }

  const db = useDatabase()

  const [request] = await db
    .select({
      id: relationships.id,
      requesterUserId: relationships.userId,
      targetUserId: relationships.targetUserId,
      relationshipType: relationships.relationshipType,
      status: relationships.status
    })
    .from(relationships)
    .where(eq(relationships.id, relationshipId))
    .limit(1)

  // Solo il destinatario di una richiesta ancora pendente puo rispondere.
  if (!request || request.targetUserId !== currentUser.id || request.status !== 'pending') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only a pending request addressed to you can be answered.'
    })
  }

  if (action === 'decline') {
    // Manteniamo la riga 'declined' per storico ed evitare re-inviti duplicati.
    await db
      .update(relationships)
      .set({ status: 'declined' })
      .where(eq(relationships.id, request.id))

    return { connected: false }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(relationships)
      .set({ status: 'accepted' })
      .where(eq(relationships.id, request.id))

    // Crea (o riattiva) la mia direzione verso il richiedente, default 'busy'.
    await tx
      .insert(relationships)
      .values({
        userId: currentUser.id,
        targetUserId: request.requesterUserId,
        relationshipType: request.relationshipType,
        visibilityRules: { mode: 'busy', hiddenCategory: null },
        status: 'accepted'
      })
      .onConflictDoUpdate({
        target: [relationships.userId, relationships.targetUserId],
        set: { status: 'accepted' }
      })
  })

  return { connected: true }
})
