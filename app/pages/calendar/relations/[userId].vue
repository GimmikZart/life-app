<script setup lang="ts">
type VisibilityMode = 'clear' | 'busy' | 'hide_category'
type EventVisibility = 'clear' | 'busy' | 'hidden'

type Connection = {
  id: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
  relationshipType: string
  visibilityRules: { mode: VisibilityMode; hiddenCategory: string | null }
}

type RelationshipsResponse = {
  connections: Connection[]
  incomingRequests: unknown[]
  outgoingRequests: unknown[]
}

type VisibilityOverride = {
  eventId: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
  visibility: EventVisibility
}

type CalendarEvent = { id: string; title: string; calendarName: string; startAt: string }
type CalendarEventsResponse = { events: CalendarEvent[]; occurrences: unknown[] }

const route = useRoute()
const userId = computed(() => String(route.params.userId))

const modes: { value: VisibilityMode; label: string }[] = [
  { value: 'busy', label: 'Solo "occupato"' },
  { value: 'clear', label: 'Mostra tutto in chiaro' },
  { value: 'hide_category', label: 'Mostra tutto tranne una categoria' }
]
const visibilityOptions: { value: EventVisibility; label: string }[] = [
  { value: 'clear', label: 'In chiaro' },
  { value: 'busy', label: 'Solo occupato' },
  { value: 'hidden', label: 'Nascosto' }
]

const today = new Date()
const rangeTo = new Date(today)
rangeTo.setDate(rangeTo.getDate() + 90)

const { data: relationshipData, refresh: refreshRelationships } = await useFetch<RelationshipsResponse>('/api/relationships', {
  default: () => ({ connections: [], incomingRequests: [], outgoingRequests: [] })
})
const { data: overrideData, refresh: refreshOverrides } = await useFetch<{ overrides: VisibilityOverride[] }>('/api/event-visibility-overrides', {
  default: () => ({ overrides: [] })
})
const { data: eventData } = await useFetch<CalendarEventsResponse>('/api/calendar-events', {
  query: {
    from: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
    to: new Date(rangeTo.getFullYear(), rangeTo.getMonth(), rangeTo.getDate(), 23, 59, 59, 999).toISOString(),
    scope: 'mine'
  },
  default: () => ({ events: [], occurrences: [] })
})

const connection = computed(() =>
  relationshipData.value?.connections.find((item) => item.targetUserId === userId.value) ?? null
)
const myOverrides = computed(() =>
  (overrideData.value?.overrides ?? []).filter((item) => item.targetUserId === userId.value)
)
const sourceEvents = computed(() => eventData.value?.events ?? [])

const form = reactive({
  relationshipType: '',
  mode: 'busy' as VisibilityMode,
  hiddenCategory: ''
})
const overrideForm = reactive({
  eventId: '',
  visibility: 'busy' as EventVisibility
})
const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

// Popola il form quando la connessione e disponibile.
watchEffect(() => {
  if (connection.value) {
    form.relationshipType = connection.value.relationshipType
    form.mode = connection.value.visibilityRules.mode
    form.hiddenCategory = connection.value.visibilityRules.hiddenCategory ?? ''
  }
})

async function runAction(action: () => Promise<string>) {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    actionMessage.value = await action()
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? (error instanceof Error ? error.message : 'Operazione non riuscita.')
  } finally {
    isSubmitting.value = false
  }
}

function saveVisibility() {
  if (!connection.value) {
    return
  }

  const id = connection.value.id

  return runAction(async () => {
    await $fetch(`/api/relationships/${id}`, {
      method: 'PATCH',
      body: {
        relationshipType: form.relationshipType,
        visibilityRules: { mode: form.mode, hiddenCategory: form.hiddenCategory || null }
      }
    })
    await refreshRelationships()

    return 'Visibilita aggiornata.'
  })
}

function removeConnection() {
  if (!connection.value) {
    return
  }

  const id = connection.value.id

  return runAction(async () => {
    await $fetch(`/api/relationships/${id}`, { method: 'DELETE' })
    await navigateTo('/calendar/relations')

    return 'Relazione rimossa.'
  })
}

function addOverride() {
  if (!connection.value) {
    return
  }

  const email = connection.value.targetEmail

  return runAction(async () => {
    await $fetch('/api/event-visibility-overrides', {
      method: 'POST',
      body: { eventId: overrideForm.eventId, targetEmail: email, visibility: overrideForm.visibility }
    })
    overrideForm.eventId = ''
    overrideForm.visibility = 'busy'
    await refreshOverrides()

    return 'Eccezione salvata.'
  })
}

function removeOverride(override: VisibilityOverride) {
  return runAction(async () => {
    await $fetch(`/api/event-visibility-overrides/${override.eventId}/${override.targetUserId}`, { method: 'DELETE' })
    await refreshOverrides()

    return 'Eccezione rimossa.'
  })
}

function eventLabel(event: CalendarEvent) {
  return `${event.title} · ${new Date(event.startAt).toLocaleDateString('it-IT')}`
}

function overrideEventLabel(eventId: string) {
  const match = sourceEvents.value.find((item) => item.id === eventId)

  return match ? match.title : 'Evento'
}
</script>

<template>
  <main class="relation-detail">
    <header class="relation-detail__header">
      <NuxtLink class="back-link" to="/calendar/relations">Torna alle relazioni</NuxtLink>
      <p class="relation-detail__eyebrow">Relazione</p>
      <h1>{{ connection?.targetName || connection?.targetEmail || 'Relazione' }}</h1>
      <p v-if="connection" class="relation-detail__hint">{{ connection.targetEmail }}</p>
    </header>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <p v-if="!connection" class="empty-state">
      Relazione non trovata. Potrebbe essere stata rimossa o non ancora accettata.
    </p>

    <template v-else>
      <section class="detail-card">
        <h2>Cosa puo vedere</h2>
        <form class="detail-form" @submit.prevent="saveVisibility">
          <label>
            Tipo di relazione
            <input v-model="form.relationshipType" type="text" required>
          </label>
          <label>
            Visibilita predefinita
            <select v-model="form.mode">
              <option v-for="mode in modes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
            </select>
          </label>
          <label v-if="form.mode === 'hide_category'">
            Categoria da nascondere
            <input v-model="form.hiddenCategory" type="text" placeholder="Es. lavoro" required>
          </label>
          <button class="button button--primary" type="submit" :disabled="isSubmitting">Salva</button>
        </form>
      </section>

      <section class="detail-card">
        <h2>Eccezioni per singolo evento</h2>
        <p class="detail-card__hint">Hanno priorita sulla visibilita predefinita qui sopra.</p>

        <form class="detail-form" @submit.prevent="addOverride">
          <label>
            Evento
            <select v-model="overrideForm.eventId" required>
              <option value="" disabled>Scegli un evento</option>
              <option v-for="event in sourceEvents" :key="event.id" :value="event.id">{{ eventLabel(event) }}</option>
            </select>
          </label>
          <label>
            Visibilita
            <select v-model="overrideForm.visibility">
              <option v-for="option in visibilityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <button class="button button--secondary" type="submit" :disabled="isSubmitting || !sourceEvents.length">Aggiungi eccezione</button>
        </form>

        <article v-for="override in myOverrides" :key="override.eventId" class="override-row">
          <span>{{ overrideEventLabel(override.eventId) }} · {{ override.visibility }}</span>
          <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="removeOverride(override)">Rimuovi</button>
        </article>
      </section>

      <section class="detail-card detail-card--danger">
        <button class="button button--danger" type="button" :disabled="isSubmitting" @click="removeConnection">
          Rimuovi relazione
        </button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.relation-detail {
  width: min(100% - (var(--shell-inline-padding) * 2), 680px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.relation-detail__header {
  margin-bottom: 18px;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.relation-detail__eyebrow {
  margin: 14px 0 6px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 4px;
  font-size: 2rem;
  line-height: 1.05;
}

h2 {
  margin: 0 0 12px;
  font-size: 1.1rem;
}

.relation-detail__hint,
.detail-card__hint,
.empty-state,
.override-row span {
  color: var(--color-muted);
  line-height: 1.5;
}

.detail-card {
  margin-top: 14px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.detail-card__hint {
  margin: -6px 0 12px;
  font-size: 0.85rem;
}

.detail-form {
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
  width: 100%;
  background: #fee2e2;
  color: #991b1b;
}

.override-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
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

@media (min-width: 760px) {
  .relation-detail {
    padding: 34px 0 44px;
  }
}
</style>
