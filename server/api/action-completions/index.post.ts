import { useDatabase } from '../../database/client'
import { actionCompletions } from '../../database/schema'
import { resolveActionOccurrence } from '../../utils/action-completion'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const calendarEventId = typeof body.calendarEventId === 'string' ? body.calendarEventId.trim() : ''
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  if (!calendarEventId) {
    throw createError({ statusCode: 400, statusMessage: 'calendarEventId e obbligatorio.' })
  }

  const db = useDatabase()
  // Il completamento parte sempre da un evento calendario specifico: da esso si
  // ricavano in modo autorevole action_id e occurrence_date (chiave univoca).
  const { actionId, occurrenceDate } = await resolveActionOccurrence(db, currentUser.id, calendarEventId)

  try {
    const [completion] = await db
      .insert(actionCompletions)
      .values({
        actionId,
        userId: currentUser.id,
        calendarEventId,
        occurrenceDate,
        completedAt: new Date(),
        // points_awarded: placeholder fino al Ciclo 4 (calcolo punti/Skill).
        pointsAwarded: {},
        notes
      })
      .returning()

    return { completion }
  } catch (error) {
    // Unique (action_id, occurrence_date): occorrenza gia completata.
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Questa occorrenza e gia stata completata.' })
    }

    throw error
  }
})
