import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { actions } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const actionId = getRouterParam(event, 'actionId')

  if (!actionId) {
    throw createError({ statusCode: 400, statusMessage: 'Action id is required.' })
  }

  const db = useDatabase()
  // La rimozione degli eventi calendario generati (coerenza bidirezionale)
  // arriva nel Sotto-Ciclo 3.3; qui la Action non genera ancora eventi.
  const [deleted] = await db
    .delete(actions)
    .where(and(eq(actions.id, actionId), eq(actions.userId, currentUser.id)))
    .returning({ id: actions.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Action non trovata.' })
  }

  return { ok: true }
})
