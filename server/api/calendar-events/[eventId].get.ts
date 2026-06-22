import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, eventAssociations, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { getCalendarMembership } from '../../utils/calendar-access'

// Restituisce il singolo evento sorgente (per la pagina di modifica). Accesso:
// membro accettato del calendario che lo contiene.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

  const db = useDatabase()
  const [row] = await db
    .select({
      id: calendarEvents.id,
      calendarId: calendarEvents.calendarId,
      title: calendarEvents.title,
      category: calendarEvents.category,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      isRecurring: calendarEvents.isRecurring,
      recurrenceRule: calendarEvents.recurrenceRule,
      visibilityDefault: calendarEvents.visibilityDefault
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found.' })
  }

  const membership = await getCalendarMembership(row.calendarId, currentUser.id)

  if (!membership || membership.status !== 'accepted') {
    throw createError({ statusCode: 403, statusMessage: 'You cannot access this event.' })
  }

  const [association] = await db
    .select({
      associatedUserId: eventAssociations.associatedUserId,
      displayConfig: eventAssociations.displayConfig,
      name: users.name
    })
    .from(eventAssociations)
    .innerJoin(users, eq(users.id, eventAssociations.associatedUserId))
    .where(eq(eventAssociations.eventId, eventId))
    .limit(1)

  return {
    event: {
      id: row.id,
      calendarId: row.calendarId,
      title: row.title,
      category: row.category,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      isRecurring: row.isRecurring,
      recurrenceRule: row.recurrenceRule,
      visibilityDefault: row.visibilityDefault,
      association: association
        ? {
            userId: association.associatedUserId,
            name: association.name,
            color: typeof association.displayConfig?.color === 'string' ? association.displayConfig.color : null,
            icon: typeof association.displayConfig?.icon === 'string' ? association.displayConfig.icon : null
          }
        : null
    }
  }
})
