import { useDatabase } from '../../database/client'
import { actions } from '../../database/schema'
import { regenerateActionEvents } from '../../utils/action-event-generation'
import { parseActionPayload } from '../../utils/action-validation'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseActionPayload(body)

  // Se l'utente sceglie un calendario di destinazione, deve poterci scrivere
  // (gli eventi generati nasceranno li). NULL = primario, risolto in generazione.
  if (payload.targetCalendarId) {
    await requireCalendarPermission(payload.targetCalendarId, currentUser.id, ['owner', 'editor'])
  }

  const db = useDatabase()
  const action = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(actions)
      .values({
        userId: currentUser.id,
        name: payload.name,
        weight: payload.weight,
        frequency: payload.frequency,
        targetCalendarId: payload.targetCalendarId
      })
      .returning()

    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Impossibile creare la Action.' })
    }

    // Materializza subito le occorrenze sul calendario (corrispondenza 1:1).
    await regenerateActionEvents(tx, {
      id: created.id,
      userId: currentUser.id,
      name: payload.name,
      frequency: payload.frequency,
      targetCalendarId: payload.targetCalendarId
    })

    return created
  })

  return { action }
})
