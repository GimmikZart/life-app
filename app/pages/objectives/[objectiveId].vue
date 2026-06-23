<script setup lang="ts">
type ObjectiveDetail = {
  objective: { id: string; title: string; description: string | null; targetDate: string | null }
  events: { id: string; title: string; startAt: string; isRecurring: boolean; calendarName: string; calendarColor: string }[]
  progress: { completed: number; planned: number; percent: number; windowDays: number }
}

type SearchResult = { id: string; title: string; startAt: string; calendarName: string }

const route = useRoute()
const objectiveId = route.params.objectiveId as string

const { data, pending, error, refresh } = await useFetch<ObjectiveDetail>(`/api/objectives/${objectiveId}`)

const actionMessage = ref('')
const errorMessage = ref('')

const editing = ref(false)
const editForm = reactive({ title: '', description: '', targetDate: '' })

const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)

const objective = computed(() => data.value?.objective ?? null)
const events = computed(() => data.value?.events ?? [])
const progress = computed(() => data.value?.progress ?? { completed: 0, planned: 0, percent: 0, windowDays: 30 })
const linkedIds = computed(() => new Set(events.value.map((item) => item.id)))

function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    const fetchError = err as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? err.message
  }

  return 'Operazione non riuscita.'
}

function startEdit() {
  if (!objective.value) {
    return
  }

  editForm.title = objective.value.title
  editForm.description = objective.value.description ?? ''
  editForm.targetDate = objective.value.targetDate ?? ''
  editing.value = true
}

async function saveEdit() {
  actionMessage.value = ''
  errorMessage.value = ''

  try {
    await $fetch(`/api/objectives/${objectiveId}` as string, {
      method: 'PATCH',
      body: {
        title: editForm.title,
        description: editForm.description || null,
        targetDate: editForm.targetDate || null
      }
    })
    editing.value = false
    actionMessage.value = 'Obiettivo aggiornato.'
    await refresh()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  searchTimer = setTimeout(runSearch, 250)
}

async function runSearch() {
  const term = searchQuery.value.trim()

  if (term.length < 2) {
    searchResults.value = []

    return
  }

  isSearching.value = true

  try {
    const response = await $fetch<{ events: SearchResult[] }>('/api/calendar-events/search', { query: { q: term } })
    searchResults.value = response.events
  } catch {
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

async function linkEvent(calendarEventId: string) {
  actionMessage.value = ''
  errorMessage.value = ''

  try {
    await $fetch('/api/event-objectives', { method: 'POST', body: { calendarEventId, objectiveId } })
    actionMessage.value = 'Evento collegato.'
    await refresh()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

async function unlinkEvent(calendarEventId: string) {
  actionMessage.value = ''
  errorMessage.value = ''

  try {
    await $fetch('/api/event-objectives' as string, { method: 'DELETE', body: { calendarEventId, objectiveId } })
    actionMessage.value = 'Evento scollegato.'
    await refresh()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return null
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <main class="objective-detail">
    <NuxtLink class="back-link" to="/objectives">Torna agli obiettivi</NuxtLink>

    <p v-if="pending" class="empty-state">Carico l'obiettivo...</p>
    <p v-else-if="error || !objective" class="empty-state empty-state--error">Obiettivo non trovato.</p>

    <template v-else>
      <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
      <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

      <section v-if="!editing" class="card">
        <p class="eyebrow">Obiettivo</p>
        <h1>{{ objective.title }}</h1>
        <p v-if="objective.description" class="muted">{{ objective.description }}</p>
        <p v-if="formatDate(objective.targetDate)" class="muted">Data target: {{ formatDate(objective.targetDate) }}</p>
        <button class="button button--ghost" type="button" @click="startEdit">Modifica</button>
      </section>

      <form v-else class="card" @submit.prevent="saveEdit">
        <label>
          Titolo
          <input v-model="editForm.title" type="text" required>
        </label>
        <label>
          Descrizione
          <textarea v-model="editForm.description" rows="2"></textarea>
        </label>
        <label>
          Data target
          <input v-model="editForm.targetDate" type="date">
        </label>
        <div class="row">
          <button class="button button--primary" type="submit">Salva</button>
          <button class="button button--ghost" type="button" @click="editing = false">Annulla</button>
        </div>
      </form>

      <section class="card">
        <p class="eyebrow">Progresso (ultimi {{ progress.windowDays }} giorni)</p>
        <div class="progress">
          <div class="progress__bar"><div class="progress__fill" :style="{ width: `${progress.percent}%` }" /></div>
          <strong>{{ progress.percent }}%</strong>
        </div>
        <p class="muted">{{ progress.completed }} di {{ progress.planned }} occorrenze completate</p>
      </section>

      <section class="card">
        <p class="eyebrow">Eventi collegati (Action)</p>
        <p v-if="!events.length" class="muted">Nessun evento collegato. Collegane uno qui sotto.</p>
        <article v-for="evt in events" :key="evt.id" class="event-row" :style="{ '--c': evt.calendarColor }">
          <span class="event-row__stripe" aria-hidden="true" />
          <div class="event-row__main">
            <strong>{{ evt.title }}</strong>
            <span class="muted">{{ formatEventDate(evt.startAt) }} · {{ evt.calendarName }}<template v-if="evt.isRecurring"> · ricorrente</template></span>
          </div>
          <button class="button button--ghost" type="button" @click="unlinkEvent(evt.id)">Scollega</button>
        </article>
      </section>

      <section class="card">
        <p class="eyebrow">Collega un evento esistente</p>
        <input
          v-model="searchQuery"
          class="search-input"
          type="search"
          placeholder="Cerca un evento per titolo..."
          @input="onSearchInput"
        >
        <p v-if="isSearching" class="muted">Cerco...</p>
        <ul v-else class="results">
          <li v-for="result in searchResults" :key="result.id">
            <span>{{ result.title }} <small class="muted">· {{ formatEventDate(result.startAt) }} · {{ result.calendarName }}</small></span>
            <button
              class="button button--secondary"
              type="button"
              :disabled="linkedIds.has(result.id)"
              @click="linkEvent(result.id)"
            >
              {{ linkedIds.has(result.id) ? 'Collegato' : 'Collega' }}
            </button>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.objective-detail {
  width: min(100% - (var(--shell-inline-padding) * 2), 860px);
  margin: 0 auto;
  padding: 18px 0 32px;
  display: grid;
  gap: 14px;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 8px;
  font-size: 1.8rem;
  line-height: 1.1;
}

.muted {
  color: var(--color-muted);
  line-height: 1.5;
}

.card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
}

label {
  display: grid;
  gap: 7px;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 800;
}

input,
textarea,
.search-input {
  width: 100%;
  padding: 11px 13px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.row {
  display: flex;
  gap: 8px;
}

.button {
  min-height: 44px;
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

.button--secondary {
  background: #e0ecff;
  color: #174ea6;
}

.progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress__bar {
  flex: 1;
  height: 12px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.progress__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-accent);
}

.event-row {
  display: grid;
  grid-template-columns: 6px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
}

.event-row__stripe {
  width: 6px;
  min-height: 40px;
  border-radius: 999px;
  background: var(--c);
}

.event-row__main {
  min-width: 0;
}

.event-row__main strong {
  display: block;
  overflow-wrap: anywhere;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.results li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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
  padding: 14px 16px;
  border-radius: 8px;
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
</style>
