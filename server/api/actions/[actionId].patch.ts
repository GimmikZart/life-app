import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { actions } from '../../database/schema'
import { regenerateActionEvents } from '../../utils/action-event-generation'
import { parseActionPayload } from '../../utils/action-validation'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const actionId = getRouterParam(event, 'actionId')

  if (!actionId) {
    throw createError({ statusCode: 400, statusMessage: 'Action id is required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseActionPayload(body)

  if (payload.targetCalendarId) {
    await requireCalendarPermission(payload.targetCalendarId, currentUser.id, ['owner', 'editor'])
  }

  const db = useDatabase()
  const action = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(actions)
      .set({
        name: payload.name,
        weight: payload.weight,
        frequency: payload.frequency,
        targetCalendarId: payload.targetCalendarId,
        updatedAt: new Date()
      })
      .where(and(eq(actions.id, actionId), eq(actions.userId, currentUser.id)))
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Action non trovata.' })
    }

    // Rigenera le occorrenze future (preservando quelle gia completate).
    await regenerateActionEvents(tx, {
      id: updated.id,
      userId: currentUser.id,
      name: payload.name,
      frequency: payload.frequency,
      targetCalendarId: payload.targetCalendarId
    })

    return updated
  })

  return { action }
})
