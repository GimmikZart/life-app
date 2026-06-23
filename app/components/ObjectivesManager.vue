<script setup lang="ts">
type ObjectiveRecord = {
  id: string
  title: string
  description: string | null
  targetDate: string | null
  createdAt: string
  eventCount: number
}

const { data, pending, error, refresh } = await useFetch<{ objectives: ObjectiveRecord[] }>('/api/objectives', {
  default: () => ({ objectives: [] })
})

const objectives = computed(() => data.value?.objectives ?? [])

const form = reactive({ title: '', description: '', targetDate: '' })
const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    const fetchError = err as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? err.message
  }

  return 'Operazione non riuscita.'
}

async function createObjective() {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await $fetch('/api/objectives', {
      method: 'POST',
      body: {
        title: form.title,
        description: form.description || null,
        targetDate: form.targetDate || null
      }
    })
    form.title = ''
    form.description = ''
    form.targetDate = ''
    actionMessage.value = 'Obiettivo creato.'
    await refresh()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  } finally {
    isSubmitting.value = false
  }
}

async function removeObjective(objective: ObjectiveRecord) {
  if (import.meta.client && !window.confirm(`Eliminare l'obiettivo "${objective.title}"?`)) {
    return
  }

  actionMessage.value = ''
  errorMessage.value = ''

  try {
    await $fetch(`/api/objectives/${objective.id}` as string, { method: 'DELETE' })
    actionMessage.value = 'Obiettivo eliminato.'
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
</script>

<template>
  <section class="objectives-tool">
    <div class="objectives-tool__header">
      <NuxtLink class="back-link" to="/">Torna alla Today</NuxtLink>
      <p class="objectives-tool__eyebrow">Obiettivi</p>
      <h1>I miei Obiettivi</h1>
      <p class="objectives-tool__lead">
        Definisci le direzioni verso cui vuoi andare. Collega gli eventi del calendario
        a un obiettivo: diventano le Action che lo fanno avanzare.
      </p>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <form class="objective-form" @submit.prevent="createObjective">
      <p class="objective-form__title">Nuovo obiettivo</p>
      <label>
        Titolo
        <input v-model="form.title" type="text" placeholder="Es. Diventare bravo nel Popping" required>
      </label>
      <label>
        Descrizione (opzionale)
        <textarea v-model="form.description" rows="2" placeholder="Cosa vuoi raggiungere"></textarea>
      </label>
      <label>
        Data target (opzionale)
        <input v-model="form.targetDate" type="date">
      </label>
      <button class="button button--primary" type="submit" :disabled="isSubmitting">Crea obiettivo</button>
    </form>

    <div class="objectives-list">
      <p v-if="pending" class="empty-state">Carico gli obiettivi...</p>
      <p v-else-if="error" class="empty-state empty-state--error">Non riesco a caricare gli obiettivi.</p>
      <p v-else-if="!objectives.length" class="empty-state">Nessun obiettivo ancora. Creane uno qui sopra.</p>

      <article v-for="objective in objectives" :key="objective.id" class="objective-card">
        <NuxtLink class="objective-card__main" :to="`/objectives/${objective.id}`">
          <strong>{{ objective.title }}</strong>
          <span v-if="objective.description" class="objective-card__meta">{{ objective.description }}</span>
          <span class="objective-card__meta">
            {{ objective.eventCount }} {{ objective.eventCount === 1 ? 'evento collegato' : 'eventi collegati' }}
            <template v-if="formatDate(objective.targetDate)"> · entro il {{ formatDate(objective.targetDate) }}</template>
          </span>
        </NuxtLink>
        <button class="button button--danger" type="button" @click="removeObjective(objective)">Elimina</button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.objectives-tool {
  width: min(100% - (var(--shell-inline-padding) * 2), 860px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.objectives-tool__header {
  margin-bottom: 18px;
}

.objectives-tool__eyebrow {
  margin: 16px 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.objectives-tool__lead {
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
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.objective-form {
  display: grid;
  gap: 12px;
  margin-bottom: 22px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.objective-form__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 900;
}

label {
  display: grid;
  gap: 7px;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 800;
}

input,
textarea {
  width: 100%;
  padding: 11px 13px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

input {
  min-height: 50px;
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

.button--danger {
  border: 1px solid #fecaca;
  background: #fff5f5;
  color: #b91c1c;
}

.objectives-list {
  display: grid;
  gap: 12px;
}

.objective-card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
}

.objective-card__main {
  display: grid;
  gap: 4px;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.objective-card__main strong {
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.objective-card__meta {
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
  .objectives-tool {
    padding: 34px 0 44px;
  }
}
</style>
