import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarEvents } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'

// Toggle leggero dell'integrazione manuale di un singolo evento nella vista
// ufficiale. Separato dal PATCH completo perche non richiede l'intero payload
// (e non avrebbe senso su una singola occorrenza di una serie ricorrente).
// pinned_to_primary e relativo al proprietario dell'evento: solo lui puo fissarlo.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)

  if (typeof body.pinnedToPrimary !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'pinnedToPrimary must be a boolean.' })
  }

  const db = useDatabase()
  const [updated] = await db
    .update(calendarEvents)
    .set({ pinnedToPrimary: body.pinnedToPrimary })
    .where(and(
      eq(calendarEvents.id, eventId),
      eq(calendarEvents.userId, currentUser.id)
    ))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Event not found or not owned by you.'
    })
  }

  return { event: updated }
})
