<script setup lang="ts">
type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'specific_date'

type ActionFrequency = {
  type: FrequencyType
  time: string
  durationMinutes: number
  timeZone: string
  daysOfWeek?: number[]
  dayOfMonth?: number
  date?: string
}

type ActionRecord = {
  id: string
  name: string
  weight: number
  frequency: ActionFrequency
  targetCalendarId: string | null
  isTemplate: boolean
  createdAt: string
  updatedAt: string
}

type CalendarOption = {
  id: string
  name: string
  myPermission: 'owner' | 'editor' | 'viewer'
  myIsPrimary: boolean
}

const weightOptions = [
  { value: 1, label: 'Routine leggera' },
  { value: 2, label: 'Impegno medio' },
  { value: 3, label: 'Sforzo significativo' }
]

const frequencyOptions: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Giornaliera' },
  { value: 'weekly', label: 'Settimanale' },
  { value: 'monthly', label: 'Mensile' },
  { value: 'specific_date', label: 'Data specifica' }
]

// 0 = domenica ... 6 = sabato (convenzione JS). Mostrati da lunedi per UX.
const weekDays = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Gio' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' }
]

const { data, pending, error, refresh } = await useFetch<{ actions: ActionRecord[] }>('/api/actions', {
  default: () => ({ actions: [] })
})

const calendars = ref<CalendarOption[]>([])

async function loadCalendars() {
  try {
    const response = await $fetch<{ calendars: CalendarOption[] }>('/api/calendars')
    // Solo i calendari su cui posso scrivere possono ospitare gli eventi generati.
    calendars.value = response.calendars.filter(
      (calendar) => calendar.myPermission === 'owner' || calendar.myPermission === 'editor'
    )
  } catch {
    calendars.value = []
  }
}

onMounted(loadCalendars)

const actions = computed(() => data.value?.actions ?? [])

const emptyForm = () => ({
  id: null as string | null,
  name: '',
  weight: 1,
  frequencyType: 'daily' as FrequencyType,
  time: '09:00',
  durationMinutes: 30,
  daysOfWeek: [] as number[],
  dayOfMonth: 1,
  date: '',
  targetCalendarId: ''
})

const form = reactive(emptyForm())
const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const isEditing = computed(() => form.id !== null)
const formTitle = computed(() => (isEditing.value ? 'Modifica Action' : 'Nuova Action'))

function getActionErrorMessage(err: unknown) {
  if (err instanceof Error) {
    const fetchError = err as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? err.message
  }

  return 'Operazione non riuscita.'
}

function resetForm() {
  Object.assign(form, emptyForm())
}

function toFormState(action: ActionRecord, asCopy: boolean) {
  const frequency = action.frequency
  Object.assign(form, {
    id: asCopy ? null : action.id,
    name: asCopy ? `${action.name} (copia)` : action.name,
    weight: action.weight,
    frequencyType: frequency.type,
    time: frequency.time ?? '09:00',
    durationMinutes: frequency.durationMinutes ?? 30,
    daysOfWeek: Array.isArray(frequency.daysOfWeek) ? [...frequency.daysOfWeek] : [],
    dayOfMonth: frequency.dayOfMonth ?? 1,
    date: frequency.date ?? '',
    targetCalendarId: action.targetCalendarId ?? ''
  })

  actionMessage.value = ''
  errorMessage.value = ''

  if (import.meta.client) {
    document.getElementById('action-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function startEdit(action: ActionRecord) {
  toFormState(action, false)
}

function duplicate(action: ActionRecord) {
  toFormState(action, true)
}

function toggleDay(day: number) {
  const index = form.daysOfWeek.indexOf(day)

  if (index === -1) {
    form.daysOfWeek.push(day)
  } else {
    form.daysOfWeek.splice(index, 1)
  }
}

function buildFrequency(): ActionFrequency {
  // La timezone serve al server per calcolare l'istante esatto delle occorrenze.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome'
  const base = { time: form.time, durationMinutes: Number(form.durationMinutes), timeZone }

  if (form.frequencyType === 'weekly') {
    return { type: 'weekly', daysOfWeek: [...form.daysOfWeek], ...base }
  }

  if (form.frequencyType === 'monthly') {
    return { type: 'monthly', dayOfMonth: Number(form.dayOfMonth), ...base }
  }

  if (form.frequencyType === 'specific_date') {
    return { type: 'specific_date', date: form.date, ...base }
  }

  return { type: 'daily', ...base }
}

async function submit() {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    const body = {
      name: form.name,
      weight: Number(form.weight),
      frequency: buildFrequency(),
      targetCalendarId: form.targetCalendarId || null
    }

    if (form.id) {
      await $fetch(`/api/actions/${form.id}` as string, { method: 'PATCH', body })
      actionMessage.value = 'Action aggiornata.'
    } else {
      await $fetch('/api/actions', { method: 'POST', body })
      actionMessage.value = 'Action creata.'
    }

    resetForm()
    await refresh()
  } catch (err) {
    errorMessage.value = getActionErrorMessage(err)
  } finally {
    isSubmitting.value = false
  }
}

async function removeAction(action: ActionRecord) {
  if (import.meta.client && !window.confirm(`Eliminare la Action "${action.name}"?`)) {
    return
  }

  actionMessage.value = ''
  errorMessage.value = ''

  try {
    await $fetch(`/api/actions/${action.id}` as string, { method: 'DELETE' })

    if (form.id === action.id) {
      resetForm()
    }

    actionMessage.value = 'Action eliminata.'
    await refresh()
  } catch (err) {
    errorMessage.value = getActionErrorMessage(err)
  }
}

function weightLabel(weight: number) {
  return weightOptions.find((option) => option.value === weight)?.label ?? `Peso ${weight}`
}

function calendarLabel(targetCalendarId: string | null) {
  if (!targetCalendarId) {
    return 'Calendario primario'
  }

  return calendars.value.find((calendar) => calendar.id === targetCalendarId)?.name ?? 'Calendario'
}

function frequencyLabel(frequency: ActionFrequency) {
  const time = frequency.time ?? ''

  if (frequency.type === 'daily') {
    return `Ogni giorno alle ${time}`
  }

  if (frequency.type === 'weekly') {
    const days = (frequency.daysOfWeek ?? [])
      .slice()
      .sort((a, b) => a - b)
      .map((day) => weekDays.find((weekDay) => weekDay.value === day)?.label ?? day)
      .join(', ')

    return `Ogni settimana (${days}) alle ${time}`
  }

  if (frequency.type === 'monthly') {
    return `Ogni mese il giorno ${frequency.dayOfMonth} alle ${time}`
  }

  return `Il ${frequency.date} alle ${time}`
}
</script>

<template>
  <section class="actions-tool">
    <div class="actions-tool__header">
      <NuxtLink class="back-link" to="/">Torna alla Today</NuxtLink>
      <p class="actions-tool__eyebrow">Action Engine</p>
      <h1>Le mie Action</h1>
      <p class="actions-tool__lead">
        Crea le Action che guidano le tue giornate. Nel prossimo passo genereranno
        automaticamente gli eventi sul calendario.
      </p>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">
      {{ actionMessage }}
    </p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">
      {{ errorMessage }}
    </p>

    <form id="action-form" class="actions-form" @submit.prevent="submit">
      <p class="actions-form__title">{{ formTitle }}</p>

      <label>
        Nome
        <input v-model="form.name" type="text" placeholder="Es. Allenamento mattutino" required>
      </label>

      <label>
        Peso
        <select v-model.number="form.weight">
          <option v-for="option in weightOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label>
        Frequenza
        <select v-model="form.frequencyType">
          <option v-for="option in frequencyOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <fieldset v-if="form.frequencyType === 'weekly'" class="weekdays">
        <legend>Giorni</legend>
        <button
          v-for="day in weekDays"
          :key="day.value"
          type="button"
          class="weekday"
          :class="{ 'weekday--on': form.daysOfWeek.includes(day.value) }"
          @click="toggleDay(day.value)"
        >
          {{ day.label }}
        </button>
      </fieldset>

      <label v-if="form.frequencyType === 'monthly'">
        Giorno del mese
        <input v-model.number="form.dayOfMonth" type="number" min="1" max="31">
      </label>

      <label v-if="form.frequencyType === 'specific_date'">
        Data
        <input v-model="form.date" type="date" required>
      </label>

      <div class="actions-form__row">
        <label>
          Orario
          <input v-model="form.time" type="time" required>
        </label>
        <label>
          Durata (min)
          <input v-model.number="form.durationMinutes" type="number" min="1" max="1440">
        </label>
      </div>

      <label>
        Calendario di destinazione
        <select v-model="form.targetCalendarId">
          <option value="">Calendario primario</option>
          <option v-for="calendar in calendars" :key="calendar.id" :value="calendar.id">
            {{ calendar.name }}
          </option>
        </select>
      </label>

      <div class="actions-form__buttons">
        <button class="button button--primary" type="submit" :disabled="isSubmitting">
          {{ isEditing ? 'Salva modifiche' : 'Crea Action' }}
        </button>
        <button
          v-if="isEditing"
          class="button button--ghost"
          type="button"
          :disabled="isSubmitting"
          @click="resetForm"
        >
          Annulla
        </button>
      </div>
    </form>

    <div class="actions-list">
      <p v-if="pending" class="empty-state">Carico le Action...</p>
      <p v-else-if="error" class="empty-state empty-state--error">
        Non riesco a caricare le Action in questo momento.
      </p>
      <p v-else-if="!actions.length" class="empty-state">
        Nessuna Action ancora. Creane una qui sopra.
      </p>

      <article v-for="action in actions" :key="action.id" class="action-card">
        <div class="action-card__main">
          <strong>{{ action.name }}</strong>
          <span class="action-card__meta">{{ weightLabel(action.weight) }}</span>
          <span class="action-card__meta">{{ frequencyLabel(action.frequency) }}</span>
          <span class="action-card__meta">{{ calendarLabel(action.targetCalendarId) }}</span>
        </div>
        <div class="action-card__buttons">
          <button class="button button--ghost" type="button" @click="startEdit(action)">Modifica</button>
          <button class="button button--ghost" type="button" @click="duplicate(action)">Duplica</button>
          <button class="button button--danger" type="button" @click="removeAction(action)">Elimina</button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.actions-tool {
  width: min(100% - (var(--shell-inline-padding) * 2), 860px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.actions-tool__header {
  margin-bottom: 18px;
}

.actions-tool__eyebrow {
  margin: 16px 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.actions-tool__lead {
  color: var(--color-muted);
  line-height: 1.6;
}

h1,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  font-size: 2.2rem;
  line-height: 1.05;
  letter-spacing: 0;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.actions-form {
  display: grid;
  gap: 12px;
  margin-bottom: 22px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.actions-form__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 900;
}

.actions-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.actions-form__buttons,
.action-card__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.weekdays legend {
  margin-bottom: 7px;
  padding: 0;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 800;
}

.weekday {
  min-width: 48px;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.weekday--on {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: #ffffff;
}

.button {
  min-height: 48px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
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

.button--ghost {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: var(--color-ink);
}

.button--danger {
  border: 1px solid #fecaca;
  background: #fff5f5;
  color: #b91c1c;
}

.actions-list {
  display: grid;
  gap: 12px;
}

.action-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
}

.action-card__main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.action-card__main strong {
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.action-card__meta {
  color: var(--color-muted);
  font-size: 0.88rem;
}

.empty-state {
  margin: 0;
  padding: 22px 16px;
  border: 1px dashed rgba(148, 163, 184, 0.6);
  border-radius: 8px;
  color: var(--color-muted);
  text-align: center;
}

.empty-state--error {
  border-color: #fecaca;
  color: #b91c1c;
}

.feedback {
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 8px;
  background: #ffffff;
  font-weight: 800;
}

.feedback--success {
  color: #166534;
}

.feedback--error {
  color: #b91c1c;
}

@media (min-width: 760px) {
  .actions-tool {
    padding: 34px 0 44px;
  }

  .actions-form {
    padding: 24px;
  }

  .action-card {
    grid-template-columns: 1fr auto;
    align-items: center;
  }
}
</style>
