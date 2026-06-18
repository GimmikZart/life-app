import { useDatabase } from '../../database/client'
import { calendarMembers, calendars } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseCalendarPayload } from '../../utils/calendar-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  const payload = parseCalendarPayload(body)
  const db = useDatabase()

  const result = await db.transaction(async (tx) => {
    const [calendar] = await tx
      .insert(calendars)
      .values({
        userId: currentUser.id,
        name: payload.name,
        color: payload.color,
        type: payload.type
      })
      .returning()

    await tx.insert(calendarMembers).values({
      calendarId: calendar.id,
      userId: currentUser.id,
      permission: 'owner',
      status: 'accepted'
    })

    return calendar
  })

  return {
    calendar: result
  }
})
