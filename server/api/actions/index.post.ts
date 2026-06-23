import { useDatabase } from '../../database/client'
import { actions } from '../../database/schema'
import { parseActionPayload } from '../../utils/action-validation'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseActionPayload(body)

  // Se l'utente sceglie un calendario di destinazione, deve poterci scrivere
  // (gli eventi generati nel 3.3 nasceranno li). NULL = primario, validato dopo.
  if (payload.targetCalendarId) {
    await requireCalendarPermission(payload.targetCalendarId, currentUser.id, ['owner', 'editor'])
  }

  const db = useDatabase()
  const [action] = await db
    .insert(actions)
    .values({
      userId: currentUser.id,
      name: payload.name,
      weight: payload.weight,
      frequency: payload.frequency,
      targetCalendarId: payload.targetCalendarId
    })
    .returning()

  if (!action) {
    throw createError({ statusCode: 500, statusMessage: 'Impossibile creare la Action.' })
  }

  return { action }
})
