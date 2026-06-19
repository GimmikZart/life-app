<script setup lang="ts">
type VisibilityMode = 'clear' | 'busy' | 'hide_category'

type Connection = {
  id: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
  relationshipType: string
  visibilityRules: { mode: VisibilityMode; hiddenCategory: string | null }
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

const { data, pending, refresh } = await useFetch<RelationshipsResponse>('/api/relationships', {
  default: () => ({ connections: [], incomingRequests: [], outgoingRequests: [] })
})

const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const visibilityLabels: Record<VisibilityMode, string> = {
  clear: 'Vede tutto in chiaro',
  busy: 'Vede solo "occupato"',
  hide_category: 'Vede tutto tranne una categoria'
}

async function runAction(action: () => Promise<string>) {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    actionMessage.value = await action()
    await refresh()
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? (error instanceof Error ? error.message : 'Operazione non riuscita.')
  } finally {
    isSubmitting.value = false
  }
}

function respondRequest(request: IncomingRequest, action: 'accept' | 'decline') {
  return runAction(async () => {
    await $fetch(`/api/relationships/${request.id}/respond`, { method: 'POST', body: { action } })

    return action === 'accept' ? 'Richiesta accettata.' : 'Richiesta rifiutata.'
  })
}

function cancelRequest(id: string) {
  return runAction(async () => {
    await $fetch(`/api/relationships/${id}`, { method: 'DELETE' })

    return 'Richiesta annullata.'
  })
}

function initialFor(name: string | null, email: string) {
  return (name?.trim()?.[0] ?? email[0] ?? '?').toLocaleUpperCase()
}
</script>

<template>
  <main class="relations">
    <header class="relations__header">
      <p class="relations__eyebrow">Calendario</p>
      <h1>Relazioni</h1>
      <p class="relations__hint">
        Le persone con cui sei connesso. Usa il menu in alto a destra per aggiungere una relazione.
      </p>
    </header>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <section v-if="data.incomingRequests.length" class="relations__section">
      <h2>Richieste ricevute</h2>
      <article v-for="request in data.incomingRequests" :key="request.id" class="relation-card relation-card--request">
        <div class="relation-card__avatar" aria-hidden="true">{{ initialFor(request.requesterName, request.requesterEmail) }}</div>
        <div class="relation-card__body">
          <strong>{{ request.requesterName || request.requesterEmail }}</strong>
          <span>{{ request.requesterEmail }} · vuole connettersi come "{{ request.relationshipType }}"</span>
        </div>
        <div class="relation-card__actions">
          <button class="button button--primary" type="button" :disabled="isSubmitting" @click="respondRequest(request, 'accept')">Accetta</button>
          <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="respondRequest(request, 'decline')">Rifiuta</button>
        </div>
      </article>
    </section>

    <section class="relations__section">
      <h2>Le tue relazioni</h2>
      <p v-if="pending" class="empty-state">Caricamento...</p>
      <p v-else-if="!data.connections.length" class="empty-state">
        Nessuna relazione ancora. Aggiungine una dal menu in alto a destra.
      </p>

      <NuxtLink
        v-for="connection in data.connections"
        :key="connection.id"
        class="relation-card relation-card--link"
        :to="`/calendar/relations/${connection.targetUserId}`"
      >
        <div class="relation-card__avatar" aria-hidden="true">{{ initialFor(connection.targetName, connection.targetEmail) }}</div>
        <div class="relation-card__body">
          <strong>{{ connection.targetName || connection.targetEmail }}</strong>
          <span>{{ connection.relationshipType }} · {{ visibilityLabels[connection.visibilityRules.mode] }}</span>
        </div>
        <span class="relation-card__chevron" aria-hidden="true">›</span>
      </NuxtLink>
    </section>

    <section v-if="data.outgoingRequests.length" class="relations__section">
      <h2>Inviti inviati</h2>
      <article v-for="request in data.outgoingRequests" :key="request.id" class="relation-card relation-card--compact">
        <div class="relation-card__body">
          <strong>{{ request.targetName || request.targetEmail }}</strong>
          <span>{{ request.targetEmail }} · in attesa di risposta</span>
        </div>
        <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="cancelRequest(request.id)">Annulla</button>
      </article>
    </section>
  </main>
</template>

<style scoped>
.relations {
  width: min(100% - (var(--shell-inline-padding) * 2), 760px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.relations__header {
  margin-bottom: 18px;
}

.relations__eyebrow {
  margin: 0 0 6px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 6px;
  font-size: 2.2rem;
  line-height: 1.05;
}

h2 {
  margin: 0 0 12px;
  font-size: 1.1rem;
}

.relations__hint,
.empty-state,
.relation-card__body span {
  color: var(--color-muted);
  line-height: 1.5;
}

.relations__section {
  margin-top: 22px;
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

.relation-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding: 14px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
  text-decoration: none;
  color: var(--color-ink);
}

.relation-card--link {
  cursor: pointer;
}

.relation-card--request {
  flex-wrap: wrap;
  background: #f8fafc;
}

.relation-card__avatar {
  display: grid;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 999px;
  background: var(--color-ink);
  color: #ffffff;
  font-weight: 900;
}

.relation-card__body {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1 1 auto;
}

.relation-card__body strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.relation-card__chevron {
  color: var(--color-muted);
  font-size: 1.6rem;
  line-height: 1;
}

.relation-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.button {
  min-height: 44px;
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

.button--ghost {
  border: 1px solid var(--color-line);
  background: #ffffff;
  color: var(--color-ink);
}

@media (min-width: 760px) {
  .relations {
    padding: 34px 0 44px;
  }
}
</style>
