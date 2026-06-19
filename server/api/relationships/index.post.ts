import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { relationships, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseRelationshipPayload } from '../../utils/visibility-validation'

// Invita un altro utente a connettersi. Crea una richiesta 'pending' nella mia
// direzione (io -> target). Se esiste gia una richiesta reciproca in attesa
// (target -> io), invitare equivale ad accettarla: entrambe diventano 'accepted'.
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
    throw createError({ statusCode: 400, statusMessage: 'Cannot connect with yourself.' })
  }

  // Richiesta reciproca gia ricevuta da questa persona? Allora questo invito
  // la accetta e la connessione diventa attiva in entrambe le direzioni.
  const [reciprocalPending] = await db
    .select({ id: relationships.id })
    .from(relationships)
    .where(and(
      eq(relationships.userId, targetUser.id),
      eq(relationships.targetUserId, currentUser.id),
      eq(relationships.status, 'pending')
    ))
    .limit(1)

  const status = reciprocalPending ? 'accepted' : 'pending'

  const relationship = await db.transaction(async (tx) => {
    if (reciprocalPending) {
      await tx
        .update(relationships)
        .set({ status: 'accepted' })
        .where(eq(relationships.id, reciprocalPending.id))
    }

    // Riga esistente nella mia direzione? La aggiorno (re-invito dopo un rifiuto,
    // riconfigurazione di una connessione gia attiva, ecc.).
    const [existing] = await tx
      .select({ id: relationships.id, status: relationships.status })
      .from(relationships)
      .where(and(
        eq(relationships.userId, currentUser.id),
        eq(relationships.targetUserId, targetUser.id)
      ))
      .limit(1)

    if (existing) {
      const [updated] = await tx
        .update(relationships)
        .set({
          relationshipType: payload.relationshipType,
          visibilityRules: payload.visibilityRules,
          // Una connessione gia accettata resta accettata; altrimenti applica lo stato calcolato.
          status: existing.status === 'accepted' ? 'accepted' : status
        })
        .where(eq(relationships.id, existing.id))
        .returning()

      return updated
    }

    const [created] = await tx
      .insert(relationships)
      .values({
        userId: currentUser.id,
        targetUserId: targetUser.id,
        relationshipType: payload.relationshipType,
        visibilityRules: payload.visibilityRules,
        status
      })
      .returning()

    return created
  })

  return {
    relationship: {
      ...relationship,
      targetEmail: targetUser.email,
      targetName: targetUser.name
    },
    connected: status === 'accepted'
  }
})
