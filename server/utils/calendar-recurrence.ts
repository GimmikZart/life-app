import { RRule } from 'rrule'

type CalendarEventForExpansion = {
  id: string
  title: string
  category: string | null
  calendarId: string
  calendarName: string
  calendarColor: string
  startAt: Date
  endAt: Date
  isRecurring: boolean
  recurrenceRule: string | null
  visibilityDefault: 'clear' | 'busy' | 'hidden'
}

export type CalendarEventOccurrence = {
  id: string
  eventId: string
  calendarId: string
  calendarName: string
  calendarColor: string
  title: string
  category: string | null
  startAt: string
  endAt: string
  isRecurring: boolean
  visibilityDefault: 'clear' | 'busy' | 'hidden'
}

export function expandCalendarEvents(
  events: CalendarEventForExpansion[],
  rangeStart: Date,
  rangeEnd: Date
) {
  return events
    .flatMap((event) => expandCalendarEvent(event, rangeStart, rangeEnd))
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
}

function expandCalendarEvent(
  event: CalendarEventForExpansion,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEventOccurrence[] {
  if (!event.isRecurring || !event.recurrenceRule) {
    return eventOverlapsRange(event.startAt, event.endAt, rangeStart, rangeEnd)
      ? [toOccurrence(event, event.id, event.startAt, event.endAt)]
      : []
  }

  const durationMs = event.endAt.getTime() - event.startAt.getTime()
  const rule = RRule.fromString(event.recurrenceRule)
  const recurringRule = new RRule({
    ...rule.origOptions,
    dtstart: event.startAt
  })

  return recurringRule
    .between(rangeStart, rangeEnd, true)
    .map((occurrenceStart) => {
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs)

      return toOccurrence(
        event,
        `${event.id}:${occurrenceStart.toISOString()}`,
        occurrenceStart,
        occurrenceEnd
      )
    })
}

function eventOverlapsRange(startAt: Date, endAt: Date, rangeStart: Date, rangeEnd: Date) {
  return startAt < rangeEnd && endAt > rangeStart
}

function toOccurrence(
  event: CalendarEventForExpansion,
  occurrenceId: string,
  startAt: Date,
  endAt: Date
): CalendarEventOccurrence {
  return {
    id: occurrenceId,
    eventId: event.id,
    calendarId: event.calendarId,
    calendarName: event.calendarName,
    calendarColor: event.calendarColor,
    title: event.title,
    category: event.category,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    isRecurring: event.isRecurring,
    visibilityDefault: event.visibilityDefault
  }
}
