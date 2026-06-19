import { and, eq } from 'drizzle-orm'

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

    if (!calendar) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Unable to create calendar.'
      })
    }

    // Se l'utente non ha ancora un primario, il primo calendario lo diventa
    // (rete di sicurezza: alla registrazione il trigger ne crea gia uno).
    const [existingPrimary] = await tx
      .select({ calendarId: calendarMembers.calendarId })
      .from(calendarMembers)
      .where(and(
        eq(calendarMembers.userId, currentUser.id),
        eq(calendarMembers.isPrimary, true)
      ))
      .limit(1)

    const isPrimary = !existingPrimary

    await tx.insert(calendarMembers).values({
      calendarId: calendar.id,
      userId: currentUser.id,
      permission: 'owner',
      status: 'accepted',
      isPrimary,
      autoIntegrate: isPrimary
    })

    return calendar
  })

  return {
    calendar: result
  }
})
