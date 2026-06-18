<script setup lang="ts">
type CalendarOccurrence = {
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

type CalendarEventsResponse = {
  events: unknown[]
  occurrences: CalendarOccurrence[]
}

const todayCacheKey = 'life-app:today-view:latest'
const today = new Date()
const todayRange = {
  from: startOfLocalDate(today).toISOString(),
  to: endOfLocalDate(today).toISOString()
}
const upcomingRange = {
  from: todayRange.from,
  to: endOfLocalDate(addDays(today, 14)).toISOString()
}

const { data, pending, error } = await useFetch<CalendarEventsResponse>('/api/calendar-events', {
  query: upcomingRange,
  default: () => readTodayCache() ?? {
    events: [],
    occurrences: []
  }
})

watch(data, (nextData) => {
  if (nextData) {
    writeTodayCache(nextData)
  }
}, { immediate: true, deep: true })

const occurrences = computed(() => data.value?.occurrences ?? [])
const todayOccurrences = computed(() =>
  occurrences.value
    .filter((occurrence) => overlapsRange(occurrence.startAt, occurrence.endAt, todayRange.from, todayRange.to))
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
)
const upcomingOccurrences = computed(() =>
  occurrences.value
    .filter((occurrence) => new Date(occurrence.startAt) > new Date())
    .slice(0, 5)
)
const freeWindows = computed(() => buildFreeWindows(todayOccurrences.value))
const timelineRows = computed(() => buildTimelineRows(todayOccurrences.value))
const offlineNotice = computed(() =>
  error.value && occurrences.value.length
    ? 'Connessione non disponibile: mostro gli ultimi eventi salvati.'
    : ''
)

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  })
}

function formatEventTime(occurrence: CalendarOccurrence) {
  return `${formatTime(occurrence.startAt)}-${formatTime(occurrence.endAt)}`
}

function buildTimelineRows(items: CalendarOccurrence[]) {
  const events = items.map((occurrence) => ({
    type: 'event' as const,
    time: formatTime(occurrence.startAt),
    title: occurrence.visibilityDefault === 'busy' ? 'Occupato' : occurrence.title,
    meta: `${formatEventTime(occurrence)} - ${occurrence.calendarName}`,
    color: occurrence.calendarColor
  }))
  const windows = buildFreeWindows(items).slice(0, 3).map((window) => ({
    type: 'free' as const,
    time: window.start,
    title: 'Finestra libera',
    meta: `${window.start}-${window.end}`,
    color: '#10b981'
  }))

  return [...events, ...windows].sort((left, right) => left.time.localeCompare(right.time))
}

function buildFreeWindows(items: CalendarOccurrence[]) {
  const dayStart = new Date(today)
  dayStart.setHours(7, 0, 0, 0)

  const dayEnd = new Date(today)
  dayEnd.setHours(22, 0, 0, 0)

  const sortedEvents = items
    .map((occurrence) => ({
      start: new Date(occurrence.startAt),
      end: new Date(occurrence.endAt)
    }))
    .filter((event) => event.end > dayStart && event.start < dayEnd)
    .sort((left, right) => left.start.getTime() - right.start.getTime())

  const windows: { start: string; end: string }[] = []
  let cursor = new Date(dayStart)

  for (const event of sortedEvents) {
    const eventStart = new Date(Math.max(event.start.getTime(), dayStart.getTime()))
    const eventEnd = new Date(Math.min(event.end.getTime(), dayEnd.getTime()))

    if (eventStart.getTime() - cursor.getTime() >= 45 * 60 * 1000) {
      windows.push({
        start: formatTime(cursor.toISOString()),
        end: formatTime(eventStart.toISOString())
      })
    }

    if (eventEnd > cursor) {
      cursor = eventEnd
    }
  }

  if (dayEnd.getTime() - cursor.getTime() >= 45 * 60 * 1000) {
    windows.push({
      start: formatTime(cursor.toISOString()),
      end: formatTime(dayEnd.toISOString())
    })
  }

  return windows
}

function overlapsRange(startAt: string, endAt: string, rangeStart: string, rangeEnd: string) {
  return new Date(startAt) < new Date(rangeEnd) && new Date(endAt) > new Date(rangeStart)
}

function startOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)

  return nextDate
}

function writeTodayCache(payload: CalendarEventsResponse) {
  if (!import.meta.client) {
    return
  }

  localStorage.setItem(todayCacheKey, JSON.stringify(payload))
}

function readTodayCache() {
  if (!import.meta.client) {
    return null
  }

  const cached = localStorage.getItem(todayCacheKey)

  if (!cached) {
    return null
  }

  try {
    return JSON.parse(cached) as CalendarEventsResponse
  } catch {
    return null
  }
}
</script>

<template>
  <main class="today-view">
    <header class="today-hero">
      <p class="today-hero__eyebrow">Today View</p>
      <h1>Oggi</h1>
      <p>
        La giornata in una vista sola: timeline, eventi di oggi, prossimi appuntamenti
        e le sezioni pronte per Action e disponibilita condivise.
      </p>
    </header>

    <p v-if="offlineNotice" class="notice notice--cache" role="status">
      {{ offlineNotice }}
    </p>
    <p v-else-if="pending" class="notice" role="status">
      Aggiorno la giornata...
    </p>
    <p v-else-if="error" class="notice notice--error" role="alert">
      Non riesco a caricare gli eventi in questo momento.
    </p>

    <section class="today-grid" aria-label="Today View">
      <article class="panel timeline-panel">
        <div class="panel__header">
          <p class="panel__eyebrow">{{ formatDay(today.toISOString()) }}</p>
          <h2>Timeline giornata</h2>
        </div>

        <p v-if="!timelineRows.length" class="empty-state">
          Nessun evento oggi. La giornata e libera, almeno per ora.
        </p>

        <div
          v-for="row in timelineRows"
          :key="`${row.type}-${row.time}-${row.title}`"
          class="timeline-row"
          :class="{ 'timeline-row--free': row.type === 'free' }"
          :style="{ '--row-color': row.color }"
        >
          <span class="timeline-row__time">{{ row.time }}</span>
          <span class="timeline-row__marker" aria-hidden="true" />
          <div>
            <strong>{{ row.title }}</strong>
            <span>{{ row.meta }}</span>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel__header">
          <p class="panel__eyebrow">Calendario</p>
          <h2>Eventi di oggi</h2>
        </div>

        <p v-if="!todayOccurrences.length" class="empty-state">
          Nessun evento in calendario per oggi.
        </p>

        <ul v-else class="event-list">
          <li
            v-for="occurrence in todayOccurrences"
            :key="occurrence.id"
            :style="{ '--event-color': occurrence.calendarColor }"
          >
            <span class="event-list__dot" aria-hidden="true" />
            <div>
              <strong>{{ occurrence.visibilityDefault === 'busy' ? 'Occupato' : occurrence.title }}</strong>
              <span>{{ formatEventTime(occurrence) }} - {{ occurrence.calendarName }}</span>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel">
        <div class="panel__header">
          <p class="panel__eyebrow">Prossimi</p>
          <h2>In arrivo</h2>
        </div>

        <p v-if="!upcomingOccurrences.length" class="empty-state">
          Nessun prossimo evento nei prossimi 14 giorni.
        </p>

        <ul v-else class="compact-list">
          <li v-for="occurrence in upcomingOccurrences" :key="occurrence.id">
            <strong>{{ occurrence.title }}</strong>
            <span>{{ formatDay(occurrence.startAt) }} - {{ formatEventTime(occurrence) }}</span>
          </li>
        </ul>
      </article>

      <article class="panel panel--placeholder">
        <div class="panel__header">
          <p class="panel__eyebrow">Ciclo 3</p>
          <h2>Action pianificate</h2>
        </div>
        <p>
          Placeholder intenzionale: questa sezione verra collegata appena arriva
          l'Action Engine.
        </p>
      </article>

      <article class="panel panel--placeholder">
        <div class="panel__header">
          <p class="panel__eyebrow">Ciclo 2.5</p>
          <h2>Disponibilita condivise</h2>
        </div>
        <p v-if="!freeWindows.length">
          Nessuno slot libero locale significativo trovato oggi.
        </p>
        <ul v-else class="compact-list">
          <li v-for="window in freeWindows.slice(0, 3)" :key="`${window.start}-${window.end}`">
            <strong>Slot libero personale</strong>
            <span>{{ window.start }}-{{ window.end }}</span>
          </li>
        </ul>
        <small>
          Il confronto con altri utenti arriva con overlay e regole di visibilita.
        </small>
      </article>
    </section>
  </main>
</template>

<style scoped>
.today-view {
  width: min(100% - (var(--shell-inline-padding) * 2), 1120px);
  margin: 0 auto;
  padding: 18px 0 28px;
}

.today-hero {
  max-width: 760px;
  margin-bottom: 18px;
}

.today-hero__eyebrow,
.panel__eyebrow {
  margin: 0 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 10px;
  font-size: clamp(3.4rem, 19vw, 6.6rem);
  line-height: 0.82;
  letter-spacing: -0.08em;
}

h2 {
  margin-bottom: 0;
  font-size: 1.2rem;
}

.today-hero p,
.empty-state,
.panel p,
.compact-list span,
.event-list span,
.timeline-row span,
small {
  color: var(--color-muted);
  line-height: 1.55;
}

.notice,
.panel {
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.93);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
}

.notice {
  margin-bottom: 14px;
  padding: 14px 16px;
  font-weight: 900;
}

.notice--cache {
  background: #fef3c7;
  color: #92400e;
}

.notice--error {
  background: #fee2e2;
  color: #991b1b;
}

.today-grid {
  display: grid;
  gap: 12px;
}

.panel {
  padding: 18px;
}

.panel__header {
  margin-bottom: 16px;
}

.panel--placeholder {
  background:
    linear-gradient(135deg, rgba(224, 236, 255, 0.9), rgba(255, 255, 255, 0.92));
}

.timeline-row {
  display: grid;
  grid-template-columns: 56px 12px 1fr;
  gap: 12px;
  padding: 13px 0;
  border-top: 1px solid var(--color-line);
}

.timeline-row__time {
  font-weight: 900;
}

.timeline-row__marker {
  width: 12px;
  height: 12px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--row-color);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--row-color) 18%, transparent);
}

.timeline-row strong,
.timeline-row span,
.compact-list strong,
.compact-list span,
.event-list strong,
.event-list span {
  display: block;
}

.timeline-row--free {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.08), transparent);
}

.compact-list,
.event-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.event-list li {
  display: grid;
  grid-template-columns: 10px 1fr;
  gap: 10px;
  align-items: start;
}

.event-list__dot {
  width: 10px;
  height: 34px;
  border-radius: 999px;
  background: var(--event-color);
}

.compact-list li {
  padding: 12px;
  border-radius: 18px;
  background: #f8fafc;
}

@media (min-width: 760px) {
  .today-view {
    padding: 40px 0;
  }

  .today-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .panel {
    padding: 24px;
  }
}

@media (min-width: 1040px) {
  .today-grid {
    grid-template-columns: 1.35fr 1fr 1fr;
  }

  .timeline-panel {
    grid-row: span 2;
  }
}
</style>
