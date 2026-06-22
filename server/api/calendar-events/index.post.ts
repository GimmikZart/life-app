import { useDatabase } from '../../database/client'
import { calendarEvents } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseEventPayload } from '../../utils/calendar-event-validation'
import { requireCalendarPermission } from '../../utils/calendar-access'
import {
  buildExternalEventValuesForCalendar,
  enqueueExternalEventSync,
  getExternalConnectionForCalendar
} from '../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const payload = parseEventPayload(await readBody<Record<string, unknown>>(event))

  await requireCalendarPermission(payload.calendarId, currentUser.id, ['owner', 'editor'])

  const db = useDatabase()
  const externalConnection = await getExternalConnectionForCalendar(payload.calendarId, currentUser.id)
  const [calendarEvent] = await db
    .insert(calendarEvents)
    .values({
      userId: currentUser.id,
      calendarId: payload.calendarId,
      title: payload.title,
      category: payload.category,
      startAt: payload.startAt,
      endAt: payload.endAt,
      isRecurring: payload.isRecurring,
      recurrenceRule: payload.recurrenceRule,
      visibilityDefault: payload.visibilityDefault,
      ...buildExternalEventValuesForCalendar(externalConnection),
      updatedAt: new Date()
    })
    .returning()

  if (!calendarEvent) {
    throw createError({ statusCode: 500, statusMessage: 'Unable to create event.' })
  }

  if (externalConnection) {
    await enqueueExternalEventSync(calendarEvent.id, 'create')
  }

  return {
    event: calendarEvent
  }
})
