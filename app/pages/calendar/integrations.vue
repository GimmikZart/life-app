<script setup lang="ts">
type Provider = 'google' | 'microsoft'
type ConnectionStatus = 'connected' | 'needs_reauth' | 'error'

type ExternalConnection = {
  id: string
  provider: Provider
  providerAccountEmail: string | null
  calendarId: string | null
  status: ConnectionStatus
  lastSyncedAt: string | null
  lastSyncError: string | null
  webhookExpiresAt: string | null
  createdAt: string
}

type ConnectionsResponse = {
  connections: ExternalConnection[]
}

const providers: Array<{
  id: Provider
  name: string
  color: string
}> = [
  { id: 'google', name: 'Google Calendar', color: '#1a73e8' },
  { id: 'microsoft', name: 'Outlook Calendar', color: '#0078d4' }
]

const route = useRoute()
const { data, pending, refresh } = await useFetch<ConnectionsResponse>('/api/external-calendars', {
  default: () => ({ connections: [] })
})

const feedback = ref(
  typeof route.query.connected === 'string'
    ? `${providerName(route.query.connected)} collegato.`
    : typeof route.query.error === 'string'
      ? route.query.error
      : ''
)
const isErrorFeedback = computed(() => typeof route.query.error === 'string')
const busyProvider = ref<Provider | null>(null)

const connectionsByProvider = computed(() =>
  new Map((data.value?.connections ?? []).map((connection) => [connection.provider, connection]))
)

async function syncProvider(provider: Provider) {
  busyProvider.value = provider
  feedback.value = ''

  try {
    const result = await $fetch<{ imported: number; deleted: number }>(`/api/external-calendars/${provider}/sync`, {
      method: 'POST'
    })
    feedback.value = `${providerName(provider)} aggiornato: ${result.imported} eventi letti, ${result.deleted} rimossi.`
    await refresh()
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    feedback.value = fetchError?.data?.statusMessage ?? 'Sincronizzazione non riuscita.'
  } finally {
    busyProvider.value = null
  }
}

async function disconnectProvider(provider: Provider) {
  const confirmed = window.confirm(`Scollegare ${providerName(provider)}? Gli eventi importati verranno rimossi da Life App.`)

  if (!confirmed) {
    return
  }

  busyProvider.value = provider
  feedback.value = ''

  try {
    await $fetch(`/api/external-calendars/${provider}`, { method: 'DELETE' })
    feedback.value = `${providerName(provider)} scollegato.`
    await refresh()
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    feedback.value = fetchError?.data?.statusMessage ?? 'Disconnessione non riuscita.'
  } finally {
    busyProvider.value = null
  }
}

function providerName(value: unknown) {
  return value === 'google' ? 'Google Calendar' : value === 'microsoft' ? 'Outlook Calendar' : 'Calendario esterno'
}

function statusLabel(status: ConnectionStatus) {
  if (status === 'needs_reauth') return 'Da ricollegare'
  if (status === 'error') return 'Errore'

  return 'Connesso'
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Mai'
  }

  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <main class="integrations-page">
    <div class="integrations-page__header">
      <NuxtLink class="back-link" to="/calendar">Torna al calendario</NuxtLink>
      <p class="integrations-page__eyebrow">Calendari esterni</p>
      <h1>Integrazioni</h1>
    </div>

    <p
      v-if="feedback"
      class="feedback"
      :class="{ 'feedback--error': isErrorFeedback || feedback.includes('non riuscita') }"
    >
      {{ feedback }}
    </p>

    <p v-if="pending" class="feedback">Carico connessioni...</p>

    <section class="provider-list" aria-label="Provider calendario">
      <article v-for="provider in providers" :key="provider.id" class="provider-card">
        <div class="provider-card__main">
          <span class="provider-card__dot" :style="{ backgroundColor: provider.color }" aria-hidden="true" />
          <div>
            <h2>{{ provider.name }}</h2>
            <p v-if="connectionsByProvider.get(provider.id)" class="provider-card__meta">
              {{ statusLabel(connectionsByProvider.get(provider.id)!.status) }}
              <template v-if="connectionsByProvider.get(provider.id)!.providerAccountEmail">
                · {{ connectionsByProvider.get(provider.id)!.providerAccountEmail }}
              </template>
            </p>
            <p v-else class="provider-card__meta">Non collegato</p>
          </div>
        </div>

        <div v-if="connectionsByProvider.get(provider.id)" class="provider-card__status">
          <span>Ultimo sync</span>
          <strong>{{ formatDate(connectionsByProvider.get(provider.id)!.lastSyncedAt) }}</strong>
        </div>

        <p v-if="connectionsByProvider.get(provider.id)?.lastSyncError" class="provider-card__error">
          {{ connectionsByProvider.get(provider.id)!.lastSyncError }}
        </p>

        <div class="provider-card__actions">
          <NuxtLink
            v-if="!connectionsByProvider.get(provider.id) || connectionsByProvider.get(provider.id)?.status === 'needs_reauth'"
            class="button button--primary"
            :to="`/api/external-calendars/${provider.id}/connect`"
            external
          >
            Collega
          </NuxtLink>
          <template v-else>
            <button
              class="button button--primary"
              type="button"
              :disabled="busyProvider === provider.id"
              @click="syncProvider(provider.id)"
            >
              Sincronizza
            </button>
            <button
              class="button button--ghost"
              type="button"
              :disabled="busyProvider === provider.id"
              @click="disconnectProvider(provider.id)"
            >
              Scollega
            </button>
          </template>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.integrations-page {
  width: min(100% - (var(--shell-inline-padding) * 2), 920px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.integrations-page__header {
  margin-bottom: 18px;
}

.integrations-page__eyebrow {
  margin: 16px 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: 2.2rem;
  line-height: 1.05;
  letter-spacing: 0;
}

h2 {
  margin-bottom: 4px;
  font-size: 1.04rem;
  line-height: 1.2;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.feedback {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #e0ecff;
  color: #174ea6;
  font-weight: 800;
}

.feedback--error,
.provider-card__error {
  background: #fee2e2;
  color: #991b1b;
}

.provider-list {
  display: grid;
  gap: 12px;
}

.provider-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: #ffffff;
}

.provider-card__main {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.provider-card__dot {
  width: 14px;
  height: 14px;
  margin-top: 4px;
  border-radius: 999px;
}

.provider-card__meta,
.provider-card__status span {
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.provider-card__status {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-line);
}

.provider-card__status strong {
  text-align: right;
}

.provider-card__error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-weight: 800;
}

.provider-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 15px;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  text-decoration: none;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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
  .integrations-page {
    padding: 34px 0 44px;
  }

  .provider-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
