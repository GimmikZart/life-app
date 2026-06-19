<script setup lang="ts">
type CalendarPermission = 'owner' | 'editor' | 'viewer'
type EventVisibility = 'clear' | 'busy' | 'hidden'
type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
type RecurrenceUnit = 'daily' | 'weekly' | 'monthly' | 'yearly'

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
  association: { userId: string; name: string | null; color: string | null; icon: string | null } | null
}

type CalendarEventsResponse = {
  events: CalendarEvent[]
  occurrences: unknown[]
}

type Connection = { targetUserId: string; targetEmail: string; targetName: string | null }
type RelationshipsResponse = { connections: Connection[]; incomingRequests: unknown[]; outgoingRequests: unknown[] }

const iconOptions = ['', '❤️', '👤', '👥', '💼', '🎉', '🏠', '🍽️']

const props = defineProps<{
  calendars: CalendarOption[]
}>()

const visibilityOptions: { value: EventVisibility; label: string }[] = [
  { value: 'clear', label: 'In chiaro' },
  { value: 'busy', label: 'Solo occupato' },
  { value: 'hidden', label: 'Nascosto' }
]
const frequencyOptions: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'none', label: 'Non si ripete' },
  { value: 'daily', label: 'Ogni giorno' },
  { value: 'weekly', label: 'Ogni settimana' },
  { value: 'monthly', label: 'Ogni mese' },
  { value: 'yearly', label: 'Ogni anno' },
  { value: 'custom', label: 'Personalizzato…' }
]
const customUnitOptions: { value: RecurrenceUnit; label: string }[] = [
  { value: 'daily', label: 'giorni' },
  { value: 'weekly', label: 'settimane' },
  { value: 'monthly', label: 'mesi' },
  { value: 'yearly', label: 'anni' }
]
const freqKeyword: Record<RecurrenceUnit, string> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY'
}

// Mostriamo gli eventi creati in una finestra ampia (per modificarli/eliminarli),
// senza esporre un filtro di periodo all'utente.
const listFrom = addDays(new Date(), -7)
const listTo = addDays(new Date(), 365)

const { data: apiData, pending, refresh } = await useFetch<CalendarEventsResponse>('/api/calendar-events', {
  query: {
    from: startOfLocalDate(listFrom).toISOString(),
    to: endOfLocalDate(listTo).toISOString(),
    scope: 'mine'
  },
  default: () => ({ events: [], occurrences: [] })
})

const { data: relationshipData } = await useFetch<RelationshipsResponse>('/api/relationships', {
  default: () => ({ connections: [], incomingRequests: [], outgoingRequests: [] })
})
const connections = computed(() => relationshipData.value?.connections ?? [])

const writableCalendars = computed(() =>
  props.calendars.filter((calendar) => calendar.myPermission === 'owner' || calendar.myPermission === 'editor')
)
const sourceEvents = computed(() => apiData.value?.events ?? [])

const eventForm = reactive({
  id: '',
  calendarId: '',
  title: '',
  category: '',
  startAt: formatDateTimeLocal(roundToNextHour(new Date())),
  endAt: formatDateTimeLocal(addHours(roundToNextHour(new Date()), 1)),
  visibilityDefault: 'clear' as EventVisibility,
  recurrenceFrequency: 'none' as RecurrenceFrequency,
  customInterval: 2,
  customUnit: 'weekly' as RecurrenceUnit,
  recurrenceUntil: '',
  associatedUserId: '',
  associatedColor: '#db2777',
  associatedIcon: ''
})
// Contatto associato presente al caricamento (per sapere se va rimosso al salvataggio).
const loadedAssociatedUserId = ref('')

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
  eventForm.visibilityDefault = 'clear'
  eventForm.recurrenceFrequency = 'none'
  eventForm.customInterval = 2
  eventForm.customUnit = 'weekly'
  eventForm.recurrenceUntil = ''
  eventForm.associatedUserId = ''
  eventForm.associatedColor = '#db2777'
  eventForm.associatedIcon = ''
  loadedAssociatedUserId.value = ''
}

function editEvent(event: CalendarEvent) {
  eventForm.id = event.id
  eventForm.calendarId = event.calendarId
  eventForm.title = event.title
  eventForm.category = event.category ?? ''
  eventForm.startAt = formatDateTimeLocal(new Date(event.startAt))
  eventForm.endAt = formatDateTimeLocal(new Date(event.endAt))
  eventForm.visibilityDefault = event.visibilityDefault
  eventForm.associatedUserId = event.association?.userId ?? ''
  eventForm.associatedColor = event.association?.color ?? '#db2777'
  eventForm.associatedIcon = event.association?.icon ?? ''
  loadedAssociatedUserId.value = event.association?.userId ?? ''
  applyRecurrenceFromRule(event.isRecurring ? event.recurrenceRule : null)

  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

async function saveEvent() {
  const recurrenceRule = buildRecurrenceRule()
  const body = {
    calendarId: eventForm.calendarId,
    title: eventForm.title,
    category: eventForm.category || null,
    startAt: new Date(eventForm.startAt).toISOString(),
    endAt: new Date(eventForm.endAt).toISOString(),
    isRecurring: recurrenceRule !== null,
    recurrenceRule,
    visibilityDefault: eventForm.visibilityDefault
  }
  const wasEditing = Boolean(eventForm.id)
  const associatedUserId = eventForm.associatedUserId
  const associatedColor = eventForm.associatedColor
  const associatedIcon = eventForm.associatedIcon
  const previousAssociated = loadedAssociatedUserId.value

  await runEventAction(async () => {
    let eventId = eventForm.id

    if (wasEditing) {
      await $fetch(`/api/calendar-events/${eventId}`, { method: 'PATCH', body })
    } else {
      const created = await $fetch<{ event: { id: string } }>('/api/calendar-events', { method: 'POST', body })
      eventId = created.event.id
    }

    // Riconcilia l'associazione a un contatto.
    if (associatedUserId) {
      await $fetch('/api/event-associations', {
        method: 'POST',
        body: { eventId, associatedUserId, color: associatedColor, icon: associatedIcon || null }
      })

      if (previousAssociated && previousAssociated !== associatedUserId) {
        await $fetch(`/api/event-associations/${eventId}/${previousAssociated}` as string, { method: 'DELETE' })
      }
    } else if (previousAssociated) {
      await $fetch(`/api/event-associations/${eventId}/${previousAssociated}` as string, { method: 'DELETE' })
    }

    resetEventForm()
  }, wasEditing ? 'Evento aggiornato.' : 'Evento creato.')
}

async function deleteEvent(event: CalendarEvent) {
  await runEventAction(async () => {
    await $fetch(`/api/calendar-events/${event.id}`, { method: 'DELETE' })

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
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? (error instanceof Error ? error.message : 'Operazione non riuscita.')
  } finally {
    isSubmitting.value = false
  }
}

// Costruisce la RRULE a partire dalla UI semplificata (null se non ricorrente).
function buildRecurrenceRule(): string | null {
  const frequency = eventForm.recurrenceFrequency

  if (frequency === 'none') {
    return null
  }

  const unit: RecurrenceUnit = frequency === 'custom' ? eventForm.customUnit : frequency
  const interval = frequency === 'custom' ? Math.max(1, Math.floor(eventForm.customInterval)) : 1
  const parts = [`FREQ=${freqKeyword[unit]}`, `INTERVAL=${interval}`]

  if (eventForm.recurrenceUntil) {
    // UNTIL in UTC a fine giornata selezionata.
    const until = new Date(`${eventForm.recurrenceUntil}T23:59:59Z`)
    parts.push(`UNTIL=${formatRruleUntil(until)}`)
  }

  return parts.join(';')
}

// Popola la UI di ricorrenza leggendo una RRULE esistente (best-effort).
function applyRecurrenceFromRule(rule: string | null) {
  eventForm.recurrenceFrequency = 'none'
  eventForm.customInterval = 2
  eventForm.customUnit = 'weekly'
  eventForm.recurrenceUntil = ''

  if (!rule) {
    return
  }

  const freqMatch = rule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i)
  const intervalMatch = rule.match(/INTERVAL=(\d+)/i)
  const untilMatch = rule.match(/UNTIL=(\d{8})/i)
  const unit = (Object.keys(freqKeyword) as RecurrenceUnit[]).find(
    (key) => freqKeyword[key] === freqMatch?.[1]?.toUpperCase()
  ) ?? 'weekly'
  const interval = intervalMatch ? Number(intervalMatch[1]) : 1

  if (interval > 1) {
    eventForm.recurrenceFrequency = 'custom'
    eventForm.customUnit = unit
    eventForm.customInterval = interval
  } else {
    eventForm.recurrenceFrequency = unit
  }

  if (untilMatch?.[1]) {
    const value = untilMatch[1]
    eventForm.recurrenceUntil = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  }
}

function formatRruleUntil(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function recurrenceSummary(event: CalendarEvent) {
  if (!event.isRecurring) {
    return 'singolo'
  }

  const rule = event.recurrenceRule ?? ''
  const freq = rule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i)?.[1]?.toUpperCase()
  const interval = Number(rule.match(/INTERVAL=(\d+)/i)?.[1] ?? '1')
  const unitKey = (Object.keys(freqKeyword) as RecurrenceUnit[]).find((key) => freqKeyword[key] === freq) ?? 'weekly'
  const labels: Record<RecurrenceUnit, [string, string]> = {
    daily: ['ogni giorno', 'giorni'],
    weekly: ['ogni settimana', 'settimane'],
    monthly: ['ogni mese', 'mesi'],
    yearly: ['ogni anno', 'anni']
  }

  return interval > 1 ? `ogni ${interval} ${labels[unitKey][1]}` : labels[unitKey][0]
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTimeLocal(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 16)
}

function startOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)

  return next
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
    <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <section class="event-editor">
      <h3>{{ isEditing ? 'Modifica evento' : 'Nuovo evento' }}</h3>

      <p v-if="!writableCalendars.length" class="empty-state">
        Serve almeno un calendario dove sei owner o editor per creare eventi.
      </p>

      <form v-else class="event-form" @submit.prevent="saveEvent">
        <label>
          Calendario
          <select v-model="eventForm.calendarId" required>
            <option v-for="calendar in writableCalendars" :key="calendar.id" :value="calendar.id">{{ calendar.name }}</option>
          </select>
        </label>

        <label>
          Titolo
          <input v-model="eventForm.title" type="text" placeholder="Es. Allenamento" required>
        </label>

        <label>
          Categoria (opzionale)
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
          Visibilita predefinita
          <select v-model="eventForm.visibilityDefault">
            <option v-for="option in visibilityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label>
          Ripetizione
          <select v-model="eventForm.recurrenceFrequency">
            <option v-for="option in frequencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <div v-if="eventForm.recurrenceFrequency === 'custom'" class="custom-recurrence">
          <label>
            Ogni
            <input v-model.number="eventForm.customInterval" type="number" min="1" step="1">
          </label>
          <label>
            Unita
            <select v-model="eventForm.customUnit">
              <option v-for="unit in customUnitOptions" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
          </label>
        </div>

        <label v-if="eventForm.recurrenceFrequency !== 'none'">
          Fino al (opzionale)
          <input v-model="eventForm.recurrenceUntil" type="date">
        </label>

        <label v-if="connections.length">
          Associa a un contatto (opzionale)
          <select v-model="eventForm.associatedUserId">
            <option value="">Nessuno</option>
            <option v-for="connection in connections" :key="connection.targetUserId" :value="connection.targetUserId">
              {{ connection.targetName || connection.targetEmail }}
            </option>
          </select>
        </label>

        <div v-if="eventForm.associatedUserId" class="association-extra">
          <label>
            Colore
            <input v-model="eventForm.associatedColor" type="color">
          </label>
          <label>
            Icona
            <select v-model="eventForm.associatedIcon">
              <option v-for="icon in iconOptions" :key="icon" :value="icon">{{ icon || 'Nessuna' }}</option>
            </select>
          </label>
        </div>

        <div class="inline-actions">
          <button class="button button--primary" type="submit" :disabled="isSubmitting">
            {{ isEditing ? 'Salva modifiche' : 'Crea evento' }}
          </button>
          <button v-if="isEditing" class="button button--ghost" type="button" @click="resetEventForm">Annulla</button>
        </div>
      </form>
    </section>

    <section class="event-list">
      <h3>I tuoi eventi</h3>

      <p v-if="pending" class="empty-state">Caricamento eventi...</p>
      <p v-else-if="!sourceEvents.length" class="empty-state">Non hai ancora creato eventi.</p>

      <article
        v-for="event in sourceEvents"
        :key="event.id"
        class="event-row"
        :style="{ '--event-color': event.calendarColor }"
      >
        <span class="event-row__stripe" aria-hidden="true" />
        <div class="event-row__main">
          <strong>{{ event.title }}</strong>
          <span>{{ formatEventDate(event.startAt) }} · {{ event.calendarName }}</span>
          <small>{{ recurrenceSummary(event) }}<template v-if="event.category"> · {{ event.category }}</template></small>
        </div>
        <div class="inline-actions">
          <button class="button button--secondary" type="button" @click="editEvent(event)">Modifica</button>
          <button class="button button--danger" type="button" :disabled="isSubmitting" @click="deleteEvent(event)">Elimina</button>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.events-panel {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
}

h3 {
  margin: 0 0 12px;
}

.event-form,
.custom-recurrence,
.association-extra {
  display: grid;
  gap: 12px;
}

input[type="color"] {
  padding: 5px;
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
  border-radius: 10px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.button {
  min-height: 48px;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
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
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 12px;
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
.event-row small {
  color: var(--color-muted);
  line-height: 1.5;
}

.event-list {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--color-line);
}

.event-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
}

.event-row__stripe {
  flex: 0 0 auto;
  width: 6px;
  min-height: 52px;
  border-radius: 999px;
  background: var(--event-color);
}

.event-row__main {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}

.event-row__main strong,
.event-row__main span,
.event-row__main small {
  display: block;
}

@media (min-width: 760px) {
  .events-panel {
    padding: 24px;
  }

  .event-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
  }

  .event-form > .inline-actions {
    grid-column: 1 / -1;
  }

  .custom-recurrence {
    grid-template-columns: 120px 1fr;
  }

  .association-extra {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
