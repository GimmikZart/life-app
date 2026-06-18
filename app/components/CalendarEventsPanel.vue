<script setup lang="ts">
type CalendarPermission = 'owner' | 'editor' | 'viewer'
type EventVisibility = 'clear' | 'busy' | 'hidden'

type CalendarOption = {
  id: string
  name: string
  color: string
  myPermission: CalendarPermission
}

type CalendarEvent = {
  id: string
  calendarId: string
  calendarName: string
  calendarColor: string
  title: string
  category: string | null
  startAt: string
  endAt: string
  isRecurring: boolean
  recurrenceRule: string | null
  visibilityDefault: EventVisibility
}

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
  visibilityDefault: EventVisibility
}

type CalendarEventsResponse = {
  events: CalendarEvent[]
  occurrences: CalendarOccurrence[]
}

const props = defineProps<{
  calendars: CalendarOption[]
}>()

const today = new Date()
const defaultRangeTo = new Date(today)
defaultRangeTo.setDate(defaultRangeTo.getDate() + 30)

const rangeFrom = ref(formatDateInput(today))
const rangeTo = ref(formatDateInput(defaultRangeTo))
const eventQuery = computed(() => ({
  from: startOfLocalDate(rangeFrom.value).toISOString(),
  to: endOfLocalDate(rangeTo.value).toISOString()
}))

const { data, pending, refresh } = await useFetch<CalendarEventsResponse>('/api/calendar-events', {
  query: eventQuery,
  default: () => ({
    events: [],
    occurrences: []
  })
})

const writableCalendars = computed(() =>
  props.calendars.filter((calendar) => calendar.myPermission === 'owner' || calendar.myPermission === 'editor')
)

const eventForm = reactive({
  id: '',
  calendarId: '',
  title: '',
  category: '',
  startAt: formatDateTimeLocal(roundToNextHour(new Date())),
  endAt: formatDateTimeLocal(addHours(roundToNextHour(new Date()), 1)),
  isRecurring: false,
  recurrenceRule: 'FREQ=WEEKLY;COUNT=4',
  visibilityDefault: 'clear' as EventVisibility
})

const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)
const isEditing = computed(() => Boolean(eventForm.id))

watch(writableCalendars, (calendars) => {
  if (!eventForm.calendarId && calendars[0]) {
    eventForm.calendarId = calendars[0].id
  }
}, { immediate: true })

function resetEventForm() {
  eventForm.id = ''
  eventForm.calendarId = writableCalendars.value[0]?.id ?? ''
  eventForm.title = ''
  eventForm.category = ''
  eventForm.startAt = formatDateTimeLocal(roundToNextHour(new Date()))
  eventForm.endAt = formatDateTimeLocal(addHours(roundToNextHour(new Date()), 1))
  eventForm.isRecurring = false
  eventForm.recurrenceRule = 'FREQ=WEEKLY;COUNT=4'
  eventForm.visibilityDefault = 'clear'
}

function editEvent(event: CalendarEvent) {
  eventForm.id = event.id
  eventForm.calendarId = event.calendarId
  eventForm.title = event.title
  eventForm.category = event.category ?? ''
  eventForm.startAt = formatDateTimeLocal(new Date(event.startAt))
  eventForm.endAt = formatDateTimeLocal(new Date(event.endAt))
  eventForm.isRecurring = event.isRecurring
  eventForm.recurrenceRule = event.recurrenceRule ?? 'FREQ=WEEKLY;COUNT=4'
  eventForm.visibilityDefault = event.visibilityDefault
}

async function saveEvent() {
  await runEventAction(async () => {
    const body = {
      calendarId: eventForm.calendarId,
      title: eventForm.title,
      category: eventForm.category || null,
      startAt: new Date(eventForm.startAt).toISOString(),
      endAt: new Date(eventForm.endAt).toISOString(),
      isRecurring: eventForm.isRecurring,
      recurrenceRule: eventForm.isRecurring ? eventForm.recurrenceRule : null,
      visibilityDefault: eventForm.visibilityDefault
    }

    if (eventForm.id) {
      await $fetch(`/api/calendar-events/${eventForm.id}`, {
        method: 'PATCH',
        body
      })
    } else {
      await $fetch('/api/calendar-events', {
        method: 'POST',
        body
      })
    }

    resetEventForm()
  }, isEditing.value ? 'Evento aggiornato.' : 'Evento creato.')
}

async function deleteEvent(event: CalendarEvent) {
  await runEventAction(async () => {
    await $fetch(`/api/calendar-events/${event.id}`, {
      method: 'DELETE'
    })

    if (eventForm.id === event.id) {
      resetEventForm()
    }
  }, 'Evento eliminato.')
}

async function runEventAction(action: () => Promise<void>, successMessage: string) {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await action()
    await refresh()
    actionMessage.value = successMessage
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Operazione evento non riuscita.'
  } finally {
    isSubmitting.value = false
  }
}

function formatOccurrenceTime(occurrence: CalendarOccurrence) {
  const start = new Date(occurrence.startAt)
  const end = new Date(occurrence.endAt)

  return `${start.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short'
  })} - ${start.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })}-${end.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

function formatDateInput(date: Date) {
  return formatDateTimeLocal(date).slice(0, 10)
}

function formatDateTimeLocal(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 16)
}

function startOfLocalDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function endOfLocalDate(value: string) {
  return new Date(`${value}T23:59:59.999`)
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function roundToNextHour(date: Date) {
  const rounded = new Date(date)
  rounded.setMinutes(0, 0, 0)
  rounded.setHours(rounded.getHours() + 1)

  return rounded
}
</script>

<template>
  <section class="events-panel">
    <div class="events-panel__header">
      <div>
        <p class="events-panel__eyebrow">Eventi</p>
        <h2>Agenda del periodo</h2>
      </div>
      <div class="range-controls">
        <label>
          Da
          <input v-model="rangeFrom" type="date">
        </label>
        <label>
          A
          <input v-model="rangeTo" type="date">
        </label>
      </div>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">
      {{ actionMessage }}
    </p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">
      {{ errorMessage }}
    </p>

    <section class="event-editor">
      <h3>{{ isEditing ? 'Modifica evento' : 'Crea evento' }}</h3>

      <p v-if="!writableCalendars.length" class="empty-state">
        Serve almeno un calendario dove sei owner o editor per creare eventi.
      </p>

      <form v-else class="event-form" @submit.prevent="saveEvent">
        <label>
          Calendario
          <select v-model="eventForm.calendarId" required>
            <option v-for="calendar in writableCalendars" :key="calendar.id" :value="calendar.id">
              {{ calendar.name }}
            </option>
          </select>
        </label>

        <label>
          Titolo
          <input v-model="eventForm.title" type="text" placeholder="Es. Allenamento" required>
        </label>

        <label>
          Categoria
          <input v-model="eventForm.category" type="text" placeholder="lavoro, famiglia, sport...">
        </label>

        <label>
          Inizio
          <input v-model="eventForm.startAt" type="datetime-local" required>
        </label>

        <label>
          Fine
          <input v-model="eventForm.endAt" type="datetime-local" required>
        </label>

        <label>
          Visibilita
          <select v-model="eventForm.visibilityDefault">
            <option value="clear">In chiaro</option>
            <option value="busy">Solo occupato</option>
            <option value="hidden">Nascosto</option>
          </select>
        </label>

        <label class="checkbox-field">
          <input v-model="eventForm.isRecurring" type="checkbox">
          Ricorrente
        </label>

        <label v-if="eventForm.isRecurring">
          RRULE
          <input v-model="eventForm.recurrenceRule" type="text" placeholder="FREQ=WEEKLY;COUNT=4">
        </label>

        <div class="inline-actions">
          <button class="button button--primary" type="submit" :disabled="isSubmitting">
            {{ isEditing ? 'Salva evento' : 'Crea evento' }}
          </button>
          <button v-if="isEditing" class="button button--ghost" type="button" @click="resetEventForm">
            Annulla
          </button>
        </div>
      </form>
    </section>

    <section class="event-list">
      <h3>Occorrenze</h3>

      <p v-if="pending" class="empty-state">Caricamento eventi...</p>
      <p v-else-if="!data.occurrences.length" class="empty-state">
        Nessun evento nel periodo selezionato.
      </p>

      <article
        v-for="occurrence in data.occurrences"
        :key="occurrence.id"
        class="event-row"
        :style="{ '--event-color': occurrence.calendarColor }"
      >
        <span class="event-row__stripe" aria-hidden="true" />
        <div class="event-row__main">
          <strong>{{ occurrence.title }}</strong>
          <span>{{ formatOccurrenceTime(occurrence) }}</span>
          <span>{{ occurrence.calendarName }}<template v-if="occurrence.category"> - {{ occurrence.category }}</template></span>
        </div>
        <div class="event-row__badges">
          <span v-if="occurrence.isRecurring">RRULE</span>
          <span>{{ occurrence.visibilityDefault }}</span>
        </div>
      </article>
    </section>

    <section class="event-list">
      <h3>Serie ed eventi sorgente</h3>

      <article
        v-for="event in data.events"
        :key="event.id"
        class="source-event"
      >
        <div>
          <strong>{{ event.title }}</strong>
          <span>{{ event.calendarName }} - {{ event.isRecurring ? 'ricorrente' : 'singolo' }}</span>
        </div>
        <div class="inline-actions">
          <button class="button button--secondary" type="button" @click="editEvent(event)">
            Modifica
          </button>
          <button class="button button--danger" type="button" :disabled="isSubmitting" @click="deleteEvent(event)">
            Elimina
          </button>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.events-panel {
  margin-top: 24px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
}

.events-panel__header {
  display: grid;
  gap: 14px;
  margin-bottom: 16px;
}

.events-panel__eyebrow {
  margin: 0 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin-top: 0;
}

.range-controls,
.event-form {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 7px;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 800;
}

input,
select {
  min-height: 50px;
  width: 100%;
  padding: 0 13px;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.checkbox-field {
  display: flex;
  align-items: center;
  min-height: 50px;
}

.checkbox-field input {
  width: 18px;
  min-height: 18px;
}

.button {
  min-height: 48px;
  padding: 0 16px;
  border: 0;
  border-radius: 16px;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.button--primary {
  background: var(--color-ink);
  color: #ffffff;
}

.button--secondary {
  background: #e0ecff;
  color: #174ea6;
}

.button--ghost {
  border: 1px solid var(--color-line);
  background: #ffffff;
  color: var(--color-ink);
}

.button--danger {
  background: #fee2e2;
  color: #991b1b;
}

.inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.feedback {
  padding: 14px 16px;
  border-radius: 18px;
  font-weight: 800;
}

.feedback--success {
  background: #dcfce7;
  color: #166534;
}

.feedback--error {
  background: #fee2e2;
  color: #b91c1c;
}

.empty-state,
.event-row span,
.source-event span {
  color: var(--color-muted);
  line-height: 1.55;
}

.event-editor,
.event-list {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--color-line);
}

.event-row,
.source-event {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 12px;
  border-radius: 18px;
  background: #f8fafc;
}

.event-row__stripe {
  flex: 0 0 auto;
  width: 6px;
  min-height: 58px;
  border-radius: 999px;
  background: var(--event-color);
}

.event-row__main,
.source-event div:first-child {
  display: grid;
  gap: 3px;
}

.event-row__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.event-row__badges span {
  padding: 5px 8px;
  border-radius: 999px;
  background: #e0ecff;
  color: #174ea6;
  font-size: 0.72rem;
  font-weight: 900;
}

@media (min-width: 760px) {
  .events-panel {
    padding: 24px;
  }

  .events-panel__header {
    grid-template-columns: 1fr auto;
    align-items: end;
  }

  .range-controls {
    grid-template-columns: repeat(2, 160px);
  }

  .event-form {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: end;
  }
}
</style>
