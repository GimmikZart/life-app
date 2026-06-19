import { RRule } from 'rrule'

import { eventVisibilityValues } from './event-visibility'

export type EventVisibility = (typeof eventVisibilityValues)[number]

export function parseEventPayload(body: Record<string, unknown>) {
  const calendarId = typeof body.calendarId === 'string' ? body.calendarId : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const category = typeof body.category === 'string' && body.category.trim()
    ? body.category.trim()
    : null
  const startAt = parseDateField(body.startAt, 'Event start is required.')
  const endAt = parseDateField(body.endAt, 'Event end is required.')
  const isRecurring = Boolean(body.isRecurring)
  const recurrenceRule = typeof body.recurrenceRule === 'string' && body.recurrenceRule.trim()
    ? normalizeRecurrenceRule(body.recurrenceRule)
    : null
  const visibilityDefault = typeof body.visibilityDefault === 'string'
    && eventVisibilityValues.includes(body.visibilityDefault as EventVisibility)
    ? body.visibilityDefault as EventVisibility
    : 'clear'
  const pinnedToPrimary = Boolean(body.pinnedToPrimary)

  if (!calendarId) {
    throw createError({ statusCode: 400, statusMessage: 'Calendar id is required.' })
  }

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Event title is required.' })
  }

  if (endAt <= startAt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Event end must be after event start.'
    })
  }

  if (isRecurring && !recurrenceRule) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Recurring events require an RRULE.'
    })
  }

  return {
    calendarId,
    title,
    category,
    startAt,
    endAt,
    isRecurring,
    recurrenceRule,
    visibilityDefault,
    pinnedToPrimary
  }
}

export function parseDateRange(query: Record<string, unknown>) {
  const now = new Date()
  const fallbackFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7))
  const fallbackTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 45))
  const from = typeof query.from === 'string' ? new Date(query.from) : fallbackFrom
  const to = typeof query.to === 'string' ? new Date(query.to) : fallbackTo

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid from/to date range.'
    })
  }

  return { from, to }
}

function parseDateField(value: unknown, errorMessage: string) {
  const date = typeof value === 'string' ? new Date(value) : null

  if (!date || Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: errorMessage })
  }

  return date
}

function normalizeRecurrenceRule(value: string) {
  const recurrenceRule = value.trim().replace(/^RRULE:/i, '').toUpperCase()

  try {
    RRule.fromString(recurrenceRule)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid RRULE.'
    })
  }

  return recurrenceRule
}
