<script setup lang="ts">
type VisibilityMode = 'clear' | 'busy' | 'hide_category'
type EventVisibility = 'clear' | 'busy' | 'hidden'

type Connection = {
  id: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
  relationshipType: string
  visibilityRules: {
    mode: VisibilityMode
    hiddenCategory: string | null
  }
}

type IncomingRequest = {
  id: string
  requesterUserId: string
  requesterEmail: string
  requesterName: string | null
  relationshipType: string
}

type OutgoingRequest = {
  id: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
  relationshipType: string
}

type RelationshipsResponse = {
  connections: Connection[]
  incomingRequests: IncomingRequest[]
  outgoingRequests: OutgoingRequest[]
}

type VisibilityOverride = {
  eventId: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
  visibility: EventVisibility
}

type CalendarEvent = {
  id: string
  title: string
  calendarName: string
  startAt: string
}

type CalendarEventsResponse = {
  events: CalendarEvent[]
  occurrences: unknown[]
}

const modes: { value: VisibilityMode; label: string }[] = [
  { value: 'clear', label: 'Mostra tutto' },
  { value: 'busy', label: 'Solo occupato' },
  { value: 'hide_category', label: 'Nascondi categoria' }
]
const visibilityOptions: { value: EventVisibility; label: string }[] = [
  { value: 'clear', label: 'In chiaro' },
  { value: 'busy', label: 'Solo occupato' },
  { value: 'hidden', label: 'Nascosto' }
]
const today = new Date()
const rangeTo = new Date(today)
rangeTo.setDate(rangeTo.getDate() + 90)

const relationshipForm = reactive({
  targetEmail: '',
  relationshipType: '',
  mode: 'busy' as VisibilityMode,
  hiddenCategory: ''
})
const overrideForm = reactive({
  eventId: '',
  targetEmail: '',
  visibility: 'busy' as EventVisibility
})
const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const { data: relationshipData, refresh: refreshRelationships } = await useFetch<RelationshipsResponse>('/api/relationships', {
  default: () => ({ connections: [], incomingRequests: [], outgoingRequests: [] })
})
const { data: overrideData, refresh: refreshOverrides } = await useFetch<{ overrides: VisibilityOverride[] }>('/api/event-visibility-overrides', {
  default: () => ({ overrides: [] })
})
const { data: eventData } = await useFetch<CalendarEventsResponse>('/api/calendar-events', {
  query: {
    from: startOfLocalDate(today).toISOString(),
    to: endOfLocalDate(rangeTo).toISOString()
  },
  default: () => ({ events: [], occurrences: [] })
})

const sourceEvents = computed(() => eventData.value?.events ?? [])

async function inviteConnection() {
  await runAction(async () => {
    const result = await $fetch<{ connected: boolean }>('/api/relationships', {
      method: 'POST',
      body: {
        targetEmail: relationshipForm.targetEmail,
        relationshipType: relationshipForm.relationshipType,
        visibilityRules: {
          mode: relationshipForm.mode,
          hiddenCategory: relationshipForm.hiddenCategory || null
        }
      }
    })

    relationshipForm.targetEmail = ''
    relationshipForm.relationshipType = ''
    relationshipForm.mode = 'busy'
    relationshipForm.hiddenCategory = ''
    await refreshRelationships()

    return result.connected ? 'Connessione attivata.' : 'Richiesta inviata.'
  })
}

async function respondRequest(request: IncomingRequest, action: 'accept' | 'decline') {
  await runAction(async () => {
    await $fetch(`/api/relationships/${request.id}/respond`, {
      method: 'POST',
      body: { action }
    })

    await refreshRelationships()

    return action === 'accept' ? 'Richiesta accettata.' : 'Richiesta rifiutata.'
  })
}

async function updateConnection(connection: Connection) {
  await runAction(async () => {
    await $fetch(`/api/relationships/${connection.id}`, {
      method: 'PATCH',
      body: {
        relationshipType: connection.relationshipType,
        visibilityRules: connection.visibilityRules
      }
    })

    await refreshRelationships()

    return 'Regole aggiornate.'
  })
}

async function removeConnection(id: string) {
  await runAction(async () => {
    await $fetch(`/api/relationships/${id}`, {
      method: 'DELETE'
    })

    await refreshRelationships()

    return 'Connessione rimossa.'
  })
}

async function saveOverride() {
  await runAction(async () => {
    await $fetch('/api/event-visibility-overrides', {
      method: 'POST',
      body: overrideForm
    })

    overrideForm.eventId = ''
    overrideForm.targetEmail = ''
    overrideForm.visibility = 'busy'
    await refreshOverrides()
  }, 'Override evento salvato.')
}

async function deleteOverride(override: VisibilityOverride) {
  await runAction(async () => {
    await $fetch(`/api/event-visibility-overrides/${override.eventId}/${override.targetUserId}`, {
      method: 'DELETE'
    })

    await refreshOverrides()
  }, 'Override eliminato.')
}

async function runAction(action: () => Promise<string | void>, fallbackMessage = 'Operazione completata.') {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    const message = await action()
    actionMessage.value = typeof message === 'string' ? message : fallbackMessage
  } catch (error) {
    errorMessage.value = getActionErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? error.message
  }

  return 'Operazione visibilita non riuscita.'
}

function formatEventLabel(event: CalendarEvent) {
  return `${event.title} - ${event.calendarName} - ${new Date(event.startAt).toLocaleDateString('it-IT')}`
}

function startOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}
</script>

<template>
  <section class="visibility-panel">
    <div class="visibility-panel__header">
      <p class="visibility-panel__eyebrow">Privacy calendario</p>
      <h2>Connessioni e visibilita</h2>
      <p>
        Connettiti con altre persone (richiesta reciproca: l'altro deve accettare).
        Di default vedono solo che sei "occupato"; decidi tu cosa mostrare in chiaro.
        Gli override per singolo evento hanno sempre priorita sulle regole di connessione.
      </p>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">
      {{ actionMessage }}
    </p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">
      {{ errorMessage }}
    </p>

    <section class="visibility-card">
      <h3>Invita una persona</h3>
      <form class="visibility-form" @submit.prevent="inviteConnection">
        <label>
          Email
          <input v-model="relationshipForm.targetEmail" type="email" placeholder="utente@esempio.it" required>
        </label>
        <label>
          Tipo relazione
          <input v-model="relationshipForm.relationshipType" type="text" placeholder="Partner, amico, famiglia..." required>
        </label>
        <label>
          Cosa puo vedere
          <select v-model="relationshipForm.mode">
            <option v-for="mode in modes" :key="mode.value" :value="mode.value">
              {{ mode.label }}
            </option>
          </select>
        </label>
        <label v-if="relationshipForm.mode === 'hide_category'">
          Categoria da nascondere
          <input v-model="relationshipForm.hiddenCategory" type="text" placeholder="Es. lavoro" required>
        </label>
        <button class="button button--primary" type="submit" :disabled="isSubmitting">
          Invita
        </button>
      </form>
    </section>

    <section v-if="relationshipData.incomingRequests.length" class="visibility-list">
      <h3>Richieste ricevute</h3>
      <article
        v-for="request in relationshipData.incomingRequests"
        :key="request.id"
        class="visibility-row visibility-row--compact"
      >
        <div>
          <strong>{{ request.requesterName || request.requesterEmail }}</strong>
          <span>{{ request.requesterEmail }} - {{ request.relationshipType }}</span>
        </div>
        <div class="inline-actions">
          <button class="button button--primary" type="button" :disabled="isSubmitting" @click="respondRequest(request, 'accept')">
            Accetta
          </button>
          <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="respondRequest(request, 'decline')">
            Rifiuta
          </button>
        </div>
      </article>
    </section>

    <section v-if="relationshipData.outgoingRequests.length" class="visibility-list">
      <h3>Richieste inviate</h3>
      <article
        v-for="request in relationshipData.outgoingRequests"
        :key="request.id"
        class="visibility-row visibility-row--compact"
      >
        <div>
          <strong>{{ request.targetName || request.targetEmail }}</strong>
          <span>{{ request.targetEmail }} - in attesa di risposta</span>
        </div>
        <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="removeConnection(request.id)">
          Annulla
        </button>
      </article>
    </section>

    <section class="visibility-list">
      <h3>Connessioni attive</h3>
      <p v-if="!relationshipData.connections.length" class="empty-state">
        Nessuna connessione attiva.
      </p>

      <article
        v-for="connection in relationshipData.connections"
        :key="connection.id"
        class="visibility-row"
      >
        <div class="visibility-row__identity">
          <strong>{{ connection.targetName || connection.targetEmail }}</strong>
          <span>{{ connection.targetEmail }}</span>
        </div>
        <form class="visibility-form visibility-form--inline" @submit.prevent="updateConnection(connection)">
          <label>
            Tipo
            <input v-model="connection.relationshipType" type="text" required>
          </label>
          <label>
            Cosa vede
            <select v-model="connection.visibilityRules.mode">
              <option v-for="mode in modes" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </label>
          <label v-if="connection.visibilityRules.mode === 'hide_category'">
            Categoria
            <input v-model="connection.visibilityRules.hiddenCategory" type="text" required>
          </label>
          <div class="inline-actions">
            <button class="button button--secondary" type="submit" :disabled="isSubmitting">
              Aggiorna
            </button>
            <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="removeConnection(connection.id)">
              Rimuovi
            </button>
          </div>
        </form>
      </article>
    </section>

    <section class="visibility-card">
      <h3>Override per evento</h3>
      <form class="visibility-form" @submit.prevent="saveOverride">
        <label>
          Evento
          <select v-model="overrideForm.eventId" required>
            <option value="" disabled>Scegli evento</option>
            <option v-for="event in sourceEvents" :key="event.id" :value="event.id">
              {{ formatEventLabel(event) }}
            </option>
          </select>
        </label>
        <label>
          Email target
          <input v-model="overrideForm.targetEmail" type="email" placeholder="utente@esempio.it" required>
        </label>
        <label>
          Visibilita
          <select v-model="overrideForm.visibility">
            <option v-for="option in visibilityOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <button class="button button--primary" type="submit" :disabled="isSubmitting || !sourceEvents.length">
          Salva override
        </button>
      </form>
    </section>

    <section class="visibility-list">
      <h3>Override attivi</h3>
      <p v-if="!overrideData.overrides.length" class="empty-state">
        Nessun override configurato.
      </p>

      <article
        v-for="override in overrideData.overrides"
        :key="`${override.eventId}-${override.targetUserId}`"
        class="visibility-row visibility-row--compact"
      >
        <div>
          <strong>{{ override.targetName || override.targetEmail }}</strong>
          <span>{{ override.targetEmail }} - {{ override.visibility }}</span>
        </div>
        <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="deleteOverride(override)">
          Rimuovi
        </button>
      </article>
    </section>
  </section>
</template>

<style scoped>
.visibility-panel {
  margin-top: 24px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
}

.visibility-panel__header {
  margin-bottom: 16px;
}

.visibility-panel__eyebrow {
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

.visibility-panel__header p,
.empty-state,
.visibility-row span {
  color: var(--color-muted);
  line-height: 1.55;
}

.visibility-card,
.visibility-list {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--color-line);
}

.visibility-form {
  display: grid;
  gap: 12px;
}

.visibility-form--inline {
  margin-top: 12px;
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

.visibility-row {
  margin-top: 10px;
  padding: 12px;
  border-radius: 18px;
  background: #f8fafc;
}

.visibility-row--compact {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.visibility-row__identity strong,
.visibility-row strong,
.visibility-row span {
  display: block;
}

@media (min-width: 760px) {
  .visibility-panel {
    padding: 24px;
  }

  .visibility-form {
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    align-items: end;
  }

  .visibility-form--inline {
    grid-template-columns: 1fr 180px 180px auto;
  }
}
</style>
