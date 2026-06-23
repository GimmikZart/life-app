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
  actionId?: string | null
  completed?: boolean
  association?: { userId: string; name: string | null; color: string | null; icon: string | null } | null
}

type CalendarEventsResponse = {
  events: unknown[]
  occurrences: CalendarOccurrence[]
}

const todayCacheKey = 'life-app:today-view:latest'
const selectedDate = ref(startOfLocalDate(new Date()))
const isDatePickerOpen = ref(false)
const { user } = useUser()

const displayName = computed(() => {
  const metadataName = user.value?.user_metadata?.name

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim()
  }

  return user.value?.email?.split('@')[0] ?? 'utente'
})

const selectedRange = computed(() => ({
  from: startOfLocalDate(selectedDate.value).toISOString(),
  to: endOfLocalDate(selectedDate.value).toISOString()
}))

const eventQuery = computed(() => ({
  from: selectedRange.value.from,
  to: selectedRange.value.to,
  // Vista ufficiale: primario + calendari integrati + eventi fissati.
  scope: 'official'
}))

const selectedDateInput = computed({
  get: () => formatDateInput(selectedDate.value),
  set: (value: string) => {
    selectedDate.value = startOfLocalDate(new Date(`${value}T00:00:00`))
    isDatePickerOpen.value = false
  }
})

const { data, pending, error, refresh } = await useFetch<CalendarEventsResponse>('/api/calendar-events', {
  query: eventQuery,
  default: () => readTodayCache() ?? {
    events: [],
    occurrences: []
  }
})

const completingId = ref<string | null>(null)
const completionError = ref('')

function completionErrorMessage(err: unknown) {
  if (err instanceof Error) {
    const fetchError = err as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? err.message
  }

  return 'Operazione non riuscita.'
}

async function completeOccurrence(occurrence: CalendarOccurrence) {
  if (!occurrence.actionId || completingId.value) {
    return
  }

  completingId.value = occurrence.id
  completionError.value = ''

  try {
    await $fetch('/api/action-completions', {
      method: 'POST',
      body: { calendarEventId: occurrence.eventId }
    })
    await refresh()
  } catch (err) {
    completionError.value = completionErrorMessage(err)
  } finally {
    completingId.value = null
  }
}

async function undoOccurrence(occurrence: CalendarOccurrence) {
  if (!occurrence.actionId || completingId.value) {
    return
  }

  completingId.value = occurrence.id
  completionError.value = ''

  try {
    await $fetch('/api/action-completions' as string, {
      method: 'DELETE',
      body: { calendarEventId: occurrence.eventId }
    })
    await refresh()
  } catch (err) {
    completionError.value = completionErrorMessage(err)
  } finally {
    completingId.value = null
  }
}

watch(data, (nextData) => {
  if (nextData) {
    writeTodayCache(nextData)
  }
}, { immediate: true, deep: true })

const dayOccurrences = computed(() =>
  (data.value?.occurrences ?? [])
    .filter((occurrence) => overlapsRange(
      occurrence.startAt,
      occurrence.endAt,
      selectedRange.value.from,
      selectedRange.value.to
    ))
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
)

const dateLabel = computed(() => {
  const offset = daysBetween(startOfLocalDate(new Date()), selectedDate.value)

  if (offset === 0) {
    return 'Oggi'
  }

  if (offset === -1) {
    return 'Ieri'
  }

  if (offset === 1) {
    return 'Domani'
  }

  return selectedDate.value.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
})

const offlineNotice = computed(() =>
  error.value && dayOccurrences.value.length
    ? 'Connessione non disponibile: mostro gli ultimi eventi salvati.'
    : ''
)

function moveDay(days: number) {
  selectedDate.value = addDays(selectedDate.value, days)
  isDatePickerOpen.value = false
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(occurrence: CalendarOccurrence) {
  return `${formatTime(occurrence.startAt)}-${formatTime(occurrence.endAt)}`
}

function formatDateInput(date: Date) {
  return formatDateTimeLocal(date).slice(0, 10)
}

function formatDateTimeLocal(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 16)
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

function daysBetween(left: Date, right: Date) {
  const dayInMs = 24 * 60 * 60 * 1000

  return Math.round((startOfLocalDate(right).getTime() - startOfLocalDate(left).getTime()) / dayInMs)
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
    <header class="today-header">
      <h1>Ciao, {{ displayName }}</h1>
      <p>Ecco i tuoi prossimi impegni.</p>
      <NuxtLink class="today-header__link" to="/actions">Le mie Action →</NuxtLink>
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
    <p v-if="completionError" class="notice notice--error" role="alert">
      {{ completionError }}
    </p>

    <section class="agenda" aria-label="Agenda giornaliera">
      <div class="agenda__toolbar">
        <button class="agenda__arrow" type="button" aria-label="Giorno precedente" @click="moveDay(-1)">
          ‹
        </button>

        <div class="agenda__date-picker">
          <button class="agenda__date-button" type="button" @click="isDatePickerOpen = !isDatePickerOpen">
            {{ dateLabel }}
          </button>
          <input
            v-if="isDatePickerOpen"
            v-model="selectedDateInput"
            class="agenda__date-input"
            type="date"
            aria-label="Seleziona data agenda"
          >
        </div>

        <button class="agenda__arrow" type="button" aria-label="Giorno successivo" @click="moveDay(1)">
          ›
        </button>
      </div>

      <div class="agenda-table">
        <div class="agenda-table__head" aria-hidden="true">
          <span>Ora</span>
          <span>Impegno</span>
        </div>

        <p v-if="!dayOccurrences.length" class="empty-state">
          Nessun impegno personale per questo giorno.
        </p>

        <article
          v-for="occurrence in dayOccurrences"
          :key="occurrence.id"
          class="agenda-row"
          :style="{ '--event-color': occurrence.association?.color || occurrence.calendarColor }"
        >
          <time class="agenda-row__time" :datetime="occurrence.startAt">
            {{ formatTime(occurrence.startAt) }}
          </time>
          <span class="agenda-row__marker" aria-hidden="true" />
          <div class="agenda-row__content" :class="{ 'agenda-row__content--done': occurrence.completed }">
            <strong>
              <template v-if="occurrence.association?.icon">{{ occurrence.association.icon }} </template>{{ occurrence.title }}
              <span v-if="occurrence.actionId" class="agenda-row__tag">Action</span>
            </strong>
            <span>{{ formatDuration(occurrence) }} - {{ occurrence.calendarName }}</span>
            <small v-if="occurrence.category">{{ occurrence.category }}</small>
            <div v-if="occurrence.actionId" class="agenda-row__complete">
              <button
                v-if="!occurrence.completed"
                class="agenda-row__btn"
                type="button"
                :disabled="completingId === occurrence.id"
                @click="completeOccurrence(occurrence)"
              >
                ✓ Completa
              </button>
              <template v-else>
                <span class="agenda-row__done">✓ Completata</span>
                <button
                  class="agenda-row__btn agenda-row__btn--ghost"
                  type="button"
                  :disabled="completingId === occurrence.id"
                  @click="undoOccurrence(occurrence)"
                >
                  Annulla
                </button>
              </template>
            </div>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.today-view {
  width: min(100% - (var(--shell-inline-padding) * 2), 860px);
  margin: 0 auto;
  padding: 20px 0 28px;
}

.today-header {
  margin-bottom: 20px;
}

.today-header__link {
  display: inline-block;
  margin-top: 4px;
  color: var(--color-accent);
  font-weight: 900;
  text-decoration: none;
}

h1,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  font-size: clamp(2.45rem, 13vw, 4.75rem);
  line-height: 0.95;
  letter-spacing: 0;
}

.today-header p,
.empty-state,
.agenda-row span,
.agenda-row small {
  color: var(--color-muted);
  line-height: 1.5;
}

.notice,
.agenda {
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.notice {
  margin-bottom: 14px;
  padding: 13px 14px;
  font-weight: 800;
}

.notice--cache {
  background: #fef3c7;
  color: #92400e;
}

.notice--error {
  background: #fee2e2;
  color: #991b1b;
}

.agenda {
  overflow: hidden;
}

.agenda__toolbar {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: center;
  border-bottom: 1px solid var(--color-line);
  background: #ffffff;
}

.agenda__arrow,
.agenda__date-button {
  min-height: 54px;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.agenda__arrow {
  font-size: 2rem;
  line-height: 1;
}

.agenda__date-picker {
  position: relative;
  display: grid;
}

.agenda__date-button {
  width: 100%;
  padding: 0 10px;
  font-size: 1.05rem;
}

.agenda__date-input {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 5;
  width: min(260px, 82vw);
  min-height: 48px;
  transform: translateX(-50%);
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: var(--shadow-soft);
  color: var(--color-ink);
  font: inherit;
}

.agenda-table {
  padding: 6px 0;
}

.agenda-table__head,
.agenda-row {
  display: grid;
  grid-template-columns: 62px 12px 1fr;
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
}

.agenda-table__head {
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.agenda-table__head span:last-child {
  grid-column: 3;
}

.agenda-row {
  border-top: 1px solid var(--color-line);
}

.agenda-row__time {
  font-weight: 900;
}

.agenda-row__marker {
  width: 10px;
  height: 38px;
  border-radius: 999px;
  background: var(--event-color);
}

.agenda-row__content,
.agenda-row strong,
.agenda-row span,
.agenda-row small {
  display: block;
}

.agenda-row__content {
  min-width: 0;
}

.agenda-row strong {
  overflow-wrap: anywhere;
}

.agenda-row__tag {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-accent);
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  vertical-align: middle;
}

.agenda-row__content--done strong {
  color: var(--color-muted);
  text-decoration: line-through;
}

.agenda-row__complete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.agenda-row__btn {
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: var(--color-ink);
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.agenda-row__btn--ghost {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: var(--color-ink);
}

.agenda-row__btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.agenda-row__done {
  color: #166534;
  font-weight: 800;
}

.empty-state {
  margin: 0;
  padding: 22px 14px;
  border-top: 1px solid var(--color-line);
}

@media (min-width: 760px) {
  .today-view {
    padding: 44px 0;
  }

  .agenda-table__head,
  .agenda-row {
    grid-template-columns: 84px 12px 1fr;
    padding: 14px 18px;
  }
}
</style>
