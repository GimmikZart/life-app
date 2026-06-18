import { eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarEvents, eventVisibilityOverrides, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { requireCalendarPermission } from '../../utils/calendar-access'
import { parseVisibilityOverridePayload } from '../../utils/visibility-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const payload = parseVisibilityOverridePayload(await readBody<Record<string, unknown>>(event))
  const db = useDatabase()

  const [calendarEvent] = await db
    .select({
      id: calendarEvents.id,
      calendarId: calendarEvents.calendarId
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, payload.eventId))
    .limit(1)

  if (!calendarEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found.' })
  }

  await requireCalendarPermission(calendarEvent.calendarId, currentUser.id, ['owner', 'editor'])

  const [targetUser] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, payload.targetEmail))
    .limit(1)

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'Target user not found.' })
  }

  if (targetUser.id === currentUser.id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot override visibility for yourself.' })
  }

  const [override] = await db
    .insert(eventVisibilityOverrides)
    .values({
      eventId: payload.eventId,
      targetUserId: targetUser.id,
      visibility: payload.visibility
    })
    .onConflictDoUpdate({
      target: [eventVisibilityOverrides.eventId, eventVisibilityOverrides.targetUserId],
      set: { visibility: payload.visibility }
    })
    .returning()

  return {
    override: {
      ...override,
      targetEmail: targetUser.email,
      targetName: targetUser.name
    }
  }
})
