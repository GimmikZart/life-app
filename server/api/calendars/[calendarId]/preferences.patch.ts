import { and, eq, ne } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { calendarMembers } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { getCalendarMembership } from '../../../utils/calendar-access'

// Aggiorna le preferenze di layer del membro corrente su un calendario:
// - isPrimary: marca questo calendario come primario (uno solo per utente).
// - autoIntegrate: include gli eventi nella vista ufficiale dell'utente.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const calendarId = getRouterParam(event, 'calendarId')

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const setPrimary = typeof body.isPrimary === 'boolean' ? body.isPrimary : undefined
  const setAutoIntegrate = typeof body.autoIntegrate === 'boolean' ? body.autoIntegrate : undefined

  if (setPrimary === undefined && setAutoIntegrate === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide isPrimary or autoIntegrate.'
    })
  }

  const membership = await getCalendarMembership(calendarId, currentUser.id)

  if (!membership || membership.status !== 'accepted') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You must be an accepted member of this calendar.'
    })
  }

  // Il primario non puo essere "spento" direttamente: si cambia eleggendone un altro.
  if (setPrimary === false) {
    throw createError({
      statusCode: 400,
      statusMessage: 'To change your primary, set another calendar as primary.'
    })
  }

  if (setPrimary === true && membership.permission !== 'owner') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only a calendar you own can be your primary.'
    })
  }

  // Il primario e sempre integrato: non puo essere de-integrato.
  if (setAutoIntegrate === false && (membership.isPrimary || setPrimary === true)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The primary calendar is always integrated.'
    })
  }

  const db = useDatabase()

  const member = await db.transaction(async (tx) => {
    if (setPrimary === true) {
      // Garantisce un solo primario per utente: sposta il flag.
      await tx
        .update(calendarMembers)
        .set({ isPrimary: false })
        .where(and(
          eq(calendarMembers.userId, currentUser.id),
          ne(calendarMembers.calendarId, calendarId)
        ))
    }

    const updates: { isPrimary?: boolean; autoIntegrate?: boolean } = {}

    if (setPrimary === true) {
      updates.isPrimary = true
      updates.autoIntegrate = true
    }

    if (setAutoIntegrate !== undefined && updates.autoIntegrate === undefined) {
      updates.autoIntegrate = setAutoIntegrate
    }

    const [updated] = await tx
      .update(calendarMembers)
      .set(updates)
      .where(and(
        eq(calendarMembers.calendarId, calendarId),
        eq(calendarMembers.userId, currentUser.id)
      ))
      .returning()

    return updated
  })

  return { member }
})
