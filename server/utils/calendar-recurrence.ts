import { RRule } from 'rrule'

// Associazione di un evento a un contatto specifico (colore/icona dedicati) — 2.6.
export type AssociationInfo = {
  userId: string
  name: string | null
  color: string | null
  icon: string | null
}

// Eccezione di una singola occorrenza (vedi tabella event_exceptions). Le date
// sono ISO per confronto diretto con la chiave generata dalla RRULE.
export type EventException = {
  occurrenceDate: string
  isCancelled: boolean
  title: string | null
  category: string | null
  startAt: string | null
  endAt: string | null
  visibilityDefault: 'clear' | 'busy' | 'hidden' | null
}

export type CalendarEventForExpansion = {
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
  pinnedToPrimary: boolean
  source?: string
  syncStatus?: 'synced' | 'pending' | 'error'
  syncError?: string | null
  association?: AssociationInfo | null
  // Action Engine (3.3): valorizzato sugli eventi materializzati da una Action.
  actionId?: string | null
}

export type CalendarEventOccurrence = {
  id: string
  eventId: string
  // Chiave dell'occorrenza (data di inizio originale generata dalla RRULE),
  // usata per identificarla nelle eccezioni. Per gli eventi singoli = startAt.
  occurrenceDate: string
  calendarId: string
  calendarName: string
  calendarColor: string
  title: string
  category: string | null
  startAt: string
  endAt: string
  isRecurring: boolean
  visibilityDefault: 'clear' | 'busy' | 'hidden'
  pinnedToPrimary: boolean
  source: string
  syncStatus: 'synced' | 'pending' | 'error'
  syncError: string | null
  association: AssociationInfo | null
  actionId: string | null
  // Completamento dell'occorrenza (Sotto-Ciclo 3.4). Valorizzato a valle
  // dell'espansione in base ad action_completions; default false.
  completed: boolean
}

export function expandCalendarEvents(
  events: CalendarEventForExpansion[],
  rangeStart: Date,
  rangeEnd: Date,
  exceptionsByEvent?: Map<string, EventException[]>
) {
  return events
    .flatMap((event) => expandCalendarEvent(event, rangeStart, rangeEnd, exceptionsByEvent?.get(event.id) ?? []))
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
}

function expandCalendarEvent(
  event: CalendarEventForExpansion,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: EventException[]
): CalendarEventOccurrence[] {
  if (!event.isRecurring || !event.recurrenceRule) {
    return eventOverlapsRange(event.startAt, event.endAt, rangeStart, rangeEnd)
      ? [toOccurrence(event, event.id, event.startAt, event.startAt, event.endAt)]
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
    .flatMap((occurrenceStart) => {
      const key = occurrenceStart.toISOString()
      const exception = exceptions.find((item) => item.occurrenceDate === key)

      // Occorrenza eliminata singolarmente.
      if (exception?.isCancelled) {
        return []
      }

      const startAt = exception?.startAt ? new Date(exception.startAt) : occurrenceStart
      const endAt = exception?.endAt
        ? new Date(exception.endAt)
        : new Date(occurrenceStart.getTime() + durationMs)

      return [toOccurrence(event, `${event.id}:${key}`, occurrenceStart, startAt, endAt, {
        title: exception?.title ?? event.title,
        category: exception?.category ?? event.category,
        visibilityDefault: exception?.visibilityDefault ?? event.visibilityDefault
      })]
    })
}

function eventOverlapsRange(startAt: Date, endAt: Date, rangeStart: Date, rangeEnd: Date) {
  return startAt < rangeEnd && endAt > rangeStart
}

function toOccurrence(
  event: CalendarEventForExpansion,
  occurrenceId: string,
  occurrenceDate: Date,
  startAt: Date,
  endAt: Date,
  overrides?: { title: string; category: string | null; visibilityDefault: 'clear' | 'busy' | 'hidden' }
): CalendarEventOccurrence {
  return {
    id: occurrenceId,
    eventId: event.id,
    occurrenceDate: occurrenceDate.toISOString(),
    calendarId: event.calendarId,
    calendarName: event.calendarName,
    calendarColor: event.calendarColor,
    title: overrides?.title ?? event.title,
    category: overrides ? overrides.category : event.category,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    isRecurring: event.isRecurring,
    visibilityDefault: overrides?.visibilityDefault ?? event.visibilityDefault,
    pinnedToPrimary: event.pinnedToPrimary,
    source: event.source ?? 'life_app',
    syncStatus: event.syncStatus ?? 'synced',
    syncError: event.syncError ?? null,
    association: event.association ?? null,
    actionId: event.actionId ?? null,
    completed: false
  }
}
