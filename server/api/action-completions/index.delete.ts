import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { actionCompletions } from '../../database/schema'
import { resolveActionOccurrence, UNDO_WINDOW_MS } from '../../utils/action-completion'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const calendarEventId = typeof body.calendarEventId === 'string' ? body.calendarEventId.trim() : ''

  if (!calendarEventId) {
    throw createError({ statusCode: 400, statusMessage: 'calendarEventId e obbligatorio.' })
  }

  const db = useDatabase()
  // L'annullamento identifica la riga tramite (action_id, occurrence_date) — non
  // tramite completed_at — eliminando l'ambiguita segnalata in revisione.
  const { actionId, occurrenceDate } = await resolveActionOccurrence(db, currentUser.id, calendarEventId)

  const [completion] = await db
    .select({ completedAt: actionCompletions.completedAt })
    .from(actionCompletions)
    .where(and(
      eq(actionCompletions.actionId, actionId),
      eq(actionCompletions.occurrenceDate, occurrenceDate),
      eq(actionCompletions.userId, currentUser.id)
    ))
    .limit(1)

  if (!completion) {
    throw createError({ statusCode: 404, statusMessage: 'Nessun completamento da annullare.' })
  }

  // Finestra di annullamento (scelta di prodotto, non vincolo di schema).
  if (Date.now() - completion.completedAt.getTime() > UNDO_WINDOW_MS) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Puoi annullare un completamento solo entro 24 ore.'
    })
  }

  await db
    .delete(actionCompletions)
    .where(and(
      eq(actionCompletions.actionId, actionId),
      eq(actionCompletions.occurrenceDate, occurrenceDate),
      eq(actionCompletions.userId, currentUser.id)
    ))

  return { ok: true }
})
