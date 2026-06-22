<script setup lang="ts">
type CalendarType = 'personal' | 'couple' | 'family' | 'work' | 'custom'
type MemberPermission = 'owner' | 'editor' | 'viewer'
type MemberStatus = 'pending' | 'accepted' | 'declined'

type CalendarItem = {
  id: string
  name: string
  color: string
  type: CalendarType
  myPermission: MemberPermission
  myStatus: MemberStatus
  myIsPrimary: boolean
  myAutoIntegrate: boolean
}

type CalendarResponse = {
  calendars: CalendarItem[]
  receivedInvites: CalendarItem[]
  sentInvites: unknown[]
}

const typeLabels: Record<CalendarType, string> = {
  personal: 'Personale',
  couple: 'Coppia',
  family: 'Famiglia',
  work: 'Lavoro',
  custom: 'Custom'
}

const { data, pending, refresh } = await useFetch<CalendarResponse>('/api/calendars', {
  default: () => ({ calendars: [], receivedInvites: [], sentInvites: [] })
})

const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const acceptedCalendars = computed(() =>
  (data.value?.calendars ?? []).filter((calendar) => calendar.myStatus === 'accepted')
)

async function answerInvite(calendar: CalendarItem, status: 'accepted' | 'declined') {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await $fetch(`/api/calendars/${calendar.id}/members/me`, { method: 'PATCH', body: { status } })
    await refresh()
    actionMessage.value = status === 'accepted' ? 'Invito accettato.' : 'Invito rifiutato.'
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? 'Operazione non riuscita.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="manage">
    <header class="manage__header">
      <p class="manage__eyebrow">Calendario</p>
      <h1>I miei calendari</h1>
      <p class="manage__hint">Tocca un calendario per gestirne nome, colore, condivisioni e integrazione.</p>
      <NuxtLink class="create-link" to="/calendar/create">+ Crea calendario</NuxtLink>
    </header>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <section v-if="data.receivedInvites.length" class="manage__section">
      <h2>Inviti ai calendari</h2>
      <article v-for="invite in data.receivedInvites" :key="invite.id" class="calendar-card calendar-card--invite" :style="{ '--calendar-color': invite.color }">
        <span class="calendar-card__color" aria-hidden="true" />
        <div class="calendar-card__body">
          <strong>{{ invite.name }}</strong>
          <span>{{ typeLabels[invite.type] }} · come {{ invite.myPermission }}</span>
        </div>
        <div class="calendar-card__actions">
          <button class="button button--primary" type="button" :disabled="isSubmitting" @click="answerInvite(invite, 'accepted')">Accetta</button>
          <button class="button button--ghost" type="button" :disabled="isSubmitting" @click="answerInvite(invite, 'declined')">Rifiuta</button>
        </div>
      </article>
    </section>

    <section class="manage__section">
      <p v-if="pending" class="empty-state">Caricamento calendari...</p>
      <p v-else-if="!acceptedCalendars.length" class="empty-state">
        Non hai ancora calendari attivi. Creane uno dal menu in alto a destra.
      </p>

      <NuxtLink
        v-for="calendar in acceptedCalendars"
        :key="calendar.id"
        class="calendar-card calendar-card--link"
        :style="{ '--calendar-color': calendar.color }"
        :to="`/calendar/manage/${calendar.id}`"
      >
        <span class="calendar-card__color" aria-hidden="true" />
        <div class="calendar-card__body">
          <strong>
            {{ calendar.name }}
            <span v-if="calendar.myIsPrimary" class="badge">Primario</span>
          </strong>
          <span>{{ typeLabels[calendar.type] }} · {{ calendar.myPermission }}</span>
        </div>
        <span class="calendar-card__chevron" aria-hidden="true">›</span>
      </NuxtLink>
    </section>
  </main>
</template>

<style scoped>
.manage {
  width: min(100% - (var(--shell-inline-padding) * 2), 760px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.manage__header {
  margin-bottom: 18px;
}

.manage__eyebrow {
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

.manage__hint,
.empty-state,
.calendar-card__body span {
  color: var(--color-muted);
  line-height: 1.5;
}

.create-link {
  display: inline-flex;
  align-items: center;
  margin-top: 12px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 10px;
  background: var(--color-ink);
  color: #ffffff;
  font-weight: 900;
  text-decoration: none;
}

.manage__section {
  margin-top: 22px;
}

.calendar-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  padding: 14px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
  color: var(--color-ink);
  text-decoration: none;
}

.calendar-card--invite {
  flex-wrap: wrap;
  background: #f8fafc;
}

.calendar-card__color {
  flex: 0 0 auto;
  width: 14px;
  height: 44px;
  border-radius: 999px;
  background: var(--calendar-color);
}

.calendar-card__body {
  display: grid;
  gap: 3px;
  flex: 1 1 auto;
  min-width: 0;
}

.calendar-card__body strong {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-ink);
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 900;
}

.calendar-card__chevron {
  color: var(--color-muted);
  font-size: 1.6rem;
  line-height: 1;
}

.calendar-card__actions {
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
  .manage {
    padding: 34px 0 44px;
  }
}
</style>
