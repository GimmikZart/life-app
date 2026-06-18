<script setup lang="ts">
type VisibilityMode = 'clear' | 'busy' | 'hide_category'
type EventVisibility = 'clear' | 'busy' | 'hidden'

type RelationshipItem = {
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
  mode: 'clear' as VisibilityMode,
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

const { data: relationshipData, refresh: refreshRelationships } = await useFetch<{ relationships: RelationshipItem[] }>('/api/relationships', {
  default: () => ({ relationships: [] })
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

async function saveRelationship() {
  await runAction(async () => {
    await $fetch('/api/relationships', {
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
    relationshipForm.mode = 'clear'
    relationshipForm.hiddenCategory = ''
    await refreshRelationships()
  }, 'Relazione salvata.')
}

async function updateRelationship(relationship: RelationshipItem) {
  await runAction(async () => {
    await $fetch(`/api/relationships/${relationship.id}`, {
      method: 'PATCH',
      body: {
        relationshipType: relationship.relationshipType,
        visibilityRules: relationship.visibilityRules
      }
    })

    await refreshRelationships()
  }, 'Regole relazione aggiornate.')
}

async function deleteRelationship(relationship: RelationshipItem) {
  await runAction(async () => {
    await $fetch(`/api/relationships/${relationship.id}`, {
      method: 'DELETE'
    })

    await refreshRelationships()
  }, 'Relazione eliminata.')
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

async function runAction(action: () => Promise<void>, successMessage: string) {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await action()
    actionMessage.value = successMessage
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Operazione visibilita non riuscita.'
  } finally {
    isSubmitting.value = false
  }
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
      <h2>Relazioni e visibilita</h2>
      <p>
        Definisci cosa vede una persona dei tuoi eventi. Gli override per singolo
        evento hanno sempre priorita sulle regole di relazione.
      </p>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">
      {{ actionMessage }}
    </p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">
      {{ errorMessage }}
    </p>

    <section class="visibility-card">
      <h3>Nuova relazione</h3>
      <form class="visibility-form" @submit.prevent="saveRelationship">
        <label>
          Email target
          <input v-model="relationshipForm.targetEmail" type="email" placeholder="utente@esempio.it" required>
        </label>
        <label>
          Tipo relazione
          <input v-model="relationshipForm.relationshipType" type="text" placeholder="Partner, amico, famiglia..." required>
        </label>
        <label>
          Regola
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
          Salva relazione
        </button>
      </form>
    </section>

    <section class="visibility-list">
      <h3>Relazioni attive</h3>
      <p v-if="!relationshipData.relationships.length" class="empty-state">
        Nessuna relazione configurata.
      </p>

      <article
        v-for="relationship in relationshipData.relationships"
        :key="relationship.id"
        class="visibility-row"
      >
        <div class="visibility-row__identity">
          <strong>{{ relationship.targetName || relationship.targetEmail }}</strong>
          <span>{{ relationship.targetEmail }}</span>
        </div>
        <form class="visibility-form visibility-form--inline" @submit.prevent="updateRelationship(relationship)">
          <label>
            Tipo
            <input v-model="relationship.relationshipType" type="text" required>
          </label>
          <label>
            Regola
            <select v-model="relationship.visibilityRules.mode">
              <option v-for="mode in modes" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </label>
          <label v-if="relationship.visibilityRules.mode === 'hide_category'">
            Categoria
            <input v-model="relationship.visibilityRules.hiddenCategory" type="text" required>
          </label>
          <div class="inline-actions">
            <button class="button button--secondary" type="submit" :disabled="isSubmitting">
              Aggiorna
            </button>
            <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="deleteRelationship(relationship)">
              Elimina
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
