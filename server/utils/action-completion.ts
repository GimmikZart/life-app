import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { actions, calendarEvents } from '../database/schema'
import { occurrenceDateForInstant } from './action-event-generation'
import type { ActionFrequency } from './action-validation'

// Finestra entro cui un completamento puo essere annullato. Scelta di prodotto
// (il piano la lascia come validazione applicativa): 24 ore dal completamento.
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000

type Database = ReturnType<typeof useDatabase>

// A partire da un evento calendario (l'unico punto di ingresso del completamento,
// Sotto-Ciclo 3.4), risolve la Action e la occurrence_date corrispondente. La
// data e calcolata nella timezone della Action, cioe la stessa usata in
// generazione: e quindi la chiave corretta per action_completions.
export async function resolveActionOccurrence(
  db: Database,
  userId: string,
  calendarEventId: string
) {
  const [calendarEvent] = await db
    .select({
      id: calendarEvents.id,
      userId: calendarEvents.userId,
      actionId: calendarEvents.actionId,
      startAt: calendarEvents.startAt
    })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, calendarEventId), eq(calendarEvents.userId, userId)))
    .limit(1)

  if (!calendarEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato.' })
  }

  if (!calendarEvent.actionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Questo evento non e un\'occorrenza di una Action.'
    })
  }

  const [action] = await db
    .select({ frequency: actions.frequency })
    .from(actions)
    .where(and(eq(actions.id, calendarEvent.actionId), eq(actions.userId, userId)))
    .limit(1)

  if (!action) {
    throw createError({ statusCode: 404, statusMessage: 'Action non trovata.' })
  }

  const timeZone = (action.frequency as unknown as ActionFrequency).timeZone
  const occurrenceDate = occurrenceDateForInstant(calendarEvent.startAt, timeZone)

  return {
    actionId: calendarEvent.actionId,
    occurrenceDate,
    calendarEventId: calendarEvent.id
  }
}
