import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { actions } from '../../database/schema'
import { removeFutureActionEvents } from '../../utils/action-event-generation'
import type { ActionFrequency } from '../../utils/action-validation'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const actionId = getRouterParam(event, 'actionId')

  if (!actionId) {
    throw createError({ statusCode: 400, statusMessage: 'Action id is required.' })
  }

  const db = useDatabase()

  await db.transaction(async (tx) => {
    const [action] = await tx
      .select()
      .from(actions)
      .where(and(eq(actions.id, actionId), eq(actions.userId, currentUser.id)))
      .limit(1)

    if (!action) {
      throw createError({ statusCode: 404, statusMessage: 'Action non trovata.' })
    }

    // Coerenza bidirezionale: gli eventi futuri NON completati generati dalla
    // Action vengono rimossi. I completati e i passati restano come storico
    // (FK calendar_events.action_id = SET NULL alla cancellazione della Action).
    await removeFutureActionEvents(tx, {
      id: action.id,
      userId: action.userId,
      name: action.name,
      frequency: action.frequency as unknown as ActionFrequency,
      targetCalendarId: action.targetCalendarId
    })

    await tx.delete(actions).where(eq(actions.id, actionId))
  })

  return { ok: true }
})
