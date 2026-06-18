<script setup lang="ts">
type CalendarType = 'personal' | 'couple' | 'family' | 'work' | 'custom'
type MemberPermission = 'owner' | 'editor' | 'viewer'
type MemberStatus = 'pending' | 'accepted' | 'declined'

type CalendarMember = {
  calendarId: string
  userId: string
  permission: MemberPermission
  status: MemberStatus
  email: string
  name: string | null
}

type CalendarItem = {
  id: string
  ownerId: string
  name: string
  color: string
  type: CalendarType
  myPermission: MemberPermission
  myStatus: MemberStatus
  members: CalendarMember[]
}

type CalendarResponse = {
  calendars: CalendarItem[]
  receivedInvites: CalendarItem[]
  sentInvites: CalendarMember[]
}

const calendarTypes: { value: CalendarType; label: string }[] = [
  { value: 'personal', label: 'Personale' },
  { value: 'couple', label: 'Coppia' },
  { value: 'family', label: 'Famiglia' },
  { value: 'work', label: 'Lavoro' },
  { value: 'custom', label: 'Custom' }
]

const memberPermissions: { value: Exclude<MemberPermission, 'owner'>; label: string }[] = [
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' }
]

const { data, pending, refresh } = await useFetch<CalendarResponse>('/api/calendars', {
  default: () => ({
    calendars: [],
    receivedInvites: [],
    sentInvites: []
  })
})

const inviteForms = reactive<Record<string, { email: string; permission: 'editor' | 'viewer' }>>({})
const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const acceptedCalendars = computed(() =>
  (data.value?.calendars ?? []).filter((calendar) => calendar.myStatus === 'accepted')
)

function getInviteForm(calendarId: string) {
  inviteForms[calendarId] ??= {
    email: '',
    permission: 'viewer'
  }

  return inviteForms[calendarId]
}

function resetFeedback() {
  actionMessage.value = ''
  errorMessage.value = ''
}

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? error.message
  }

  return 'Operazione non riuscita.'
}

async function runCalendarAction(action: () => Promise<void>, successMessage: string) {
  resetFeedback()
  isSubmitting.value = true

  try {
    await action()
    await refresh()
    actionMessage.value = successMessage
  } catch (error) {
    errorMessage.value = getActionErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}

async function updateCalendar(calendar: CalendarItem) {
  await runCalendarAction(async () => {
    await $fetch(`/api/calendars/${calendar.id}`, {
      method: 'PATCH',
      body: {
        name: calendar.name,
        color: calendar.color,
        type: calendar.type
      }
    })
  }, 'Calendario aggiornato.')
}

async function deleteCalendar(calendar: CalendarItem) {
  await runCalendarAction(async () => {
    await $fetch(`/api/calendars/${calendar.id}`, {
      method: 'DELETE'
    })
  }, 'Calendario eliminato.')
}

async function inviteMember(calendar: CalendarItem) {
  const form = getInviteForm(calendar.id)

  await runCalendarAction(async () => {
    await $fetch(`/api/calendars/${calendar.id}/members`, {
      method: 'POST',
      body: form
    })

    form.email = ''
    form.permission = 'viewer'
  }, 'Invito inviato o aggiornato.')
}

async function updateMember(calendar: CalendarItem, member: CalendarMember) {
  await runCalendarAction(async () => {
    await $fetch(`/api/calendars/${calendar.id}/members/${member.userId}`, {
      method: 'PATCH',
      body: {
        permission: member.permission
      }
    })
  }, 'Ruolo aggiornato.')
}

async function removeMember(calendar: CalendarItem, member: CalendarMember) {
  await runCalendarAction(async () => {
    await $fetch(`/api/calendars/${calendar.id}/members/${member.userId}` as string, {
      method: 'DELETE'
    })
  }, 'Membro rimosso.')
}

async function answerInvite(calendar: CalendarItem, status: 'accepted' | 'declined') {
  await runCalendarAction(async () => {
    await $fetch(`/api/calendars/${calendar.id}/members/me`, {
      method: 'PATCH',
      body: { status }
    })
  }, status === 'accepted' ? 'Invito accettato.' : 'Invito rifiutato.')
}
</script>

<template>
  <section class="calendar-tool">
    <div class="calendar-tool__header">
      <NuxtLink class="back-link" to="/calendar">Torna al calendario</NuxtLink>
      <p class="calendar-tool__eyebrow">Gestione</p>
      <h1>I miei calendari</h1>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">
      {{ actionMessage }}
    </p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-if="data.receivedInvites.length" class="section-card">
      <div class="section-card__header">
        <p class="section-card__eyebrow">Inviti</p>
        <h2>Da accettare</h2>
      </div>

      <article
        v-for="invite in data.receivedInvites"
        :key="invite.id"
        class="invite-card"
      >
        <div>
          <strong>{{ invite.name }}</strong>
          <span>{{ invite.type }} - {{ invite.myPermission }}</span>
        </div>
        <div class="inline-actions">
          <button class="button button--primary" :disabled="isSubmitting" @click="answerInvite(invite, 'accepted')">
            Accetta
          </button>
          <button class="button button--ghost" :disabled="isSubmitting" @click="answerInvite(invite, 'declined')">
            Rifiuta
          </button>
        </div>
      </article>
    </section>

    <section class="calendar-list" aria-label="I miei calendari">
      <p v-if="pending" class="empty-state">Caricamento calendari...</p>
      <p v-else-if="!acceptedCalendars.length" class="empty-state">
        Non hai ancora calendari attivi. Creane uno per iniziare.
      </p>

      <article
        v-for="calendar in acceptedCalendars"
        :key="calendar.id"
        class="calendar-card"
        :style="{ '--calendar-color': calendar.color }"
      >
        <div class="calendar-card__title">
          <span class="calendar-card__color" aria-hidden="true" />
          <div>
            <h3>{{ calendar.name }}</h3>
            <p>{{ calendar.type }} - {{ calendar.myPermission }}</p>
          </div>
        </div>

        <form class="calendar-form calendar-form--compact" @submit.prevent="updateCalendar(calendar)">
          <label>
            Nome
            <input v-model="calendar.name" type="text" required :disabled="calendar.myPermission === 'viewer'">
          </label>
          <label>
            Tipo
            <select v-model="calendar.type" :disabled="calendar.myPermission === 'viewer'">
              <option v-for="type in calendarTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </label>
          <label>
            Colore
            <input v-model="calendar.color" type="color" :disabled="calendar.myPermission === 'viewer'">
          </label>

          <div class="inline-actions">
            <button
              class="button button--secondary"
              type="submit"
              :disabled="isSubmitting || calendar.myPermission === 'viewer'"
            >
              Salva
            </button>
            <button
              v-if="calendar.myPermission === 'owner'"
              class="button button--danger"
              type="button"
              :disabled="isSubmitting"
              @click="deleteCalendar(calendar)"
            >
              Elimina
            </button>
          </div>
        </form>

        <section v-if="calendar.myPermission === 'owner'" class="members-panel">
          <h4>Invita membro</h4>
          <form class="invite-form" @submit.prevent="inviteMember(calendar)">
            <input
              v-model="getInviteForm(calendar.id).email"
              type="email"
              placeholder="email utente registrato"
              required
            >
            <select v-model="getInviteForm(calendar.id).permission">
              <option v-for="permission in memberPermissions" :key="permission.value" :value="permission.value">
                {{ permission.label }}
              </option>
            </select>
            <button class="button button--primary" type="submit" :disabled="isSubmitting">
              Invita
            </button>
          </form>

          <h4>Membri e inviti</h4>
          <div class="member-list">
            <article
              v-for="member in calendar.members"
              :key="member.userId"
              class="member-row"
            >
              <div>
                <strong>{{ member.name || member.email }}</strong>
                <span>{{ member.email }} - {{ member.status }}</span>
              </div>

              <div class="member-row__actions">
                <select
                  v-model="member.permission"
                  :disabled="member.permission === 'owner'"
                  @change="updateMember(calendar, member)"
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  v-if="member.permission !== 'owner'"
                  class="button button--ghost"
                  type="button"
                  :disabled="isSubmitting"
                  @click="removeMember(calendar, member)"
                >
                  Rimuovi
                </button>
              </div>
            </article>
          </div>
        </section>
      </article>
    </section>
  </section>
</template>

<style scoped>
.calendar-tool {
  width: min(100% - (var(--shell-inline-padding) * 2), 1120px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.calendar-tool__header {
  margin-bottom: 18px;
}

.calendar-tool__eyebrow,
.section-card__eyebrow {
  margin: 16px 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
h2,
h3,
h4,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: 2.2rem;
  line-height: 1.05;
  letter-spacing: 0;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.empty-state,
.invite-card span,
.member-row span,
.calendar-card__title p {
  color: var(--color-muted);
  line-height: 1.55;
}

.feedback,
.section-card,
.calendar-card {
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.feedback {
  margin-bottom: 14px;
  padding: 14px 16px;
  font-weight: 800;
}

.feedback--success {
  color: #166534;
}

.feedback--error {
  color: #b91c1c;
}

.section-card,
.calendar-card {
  margin-top: 14px;
  padding: 18px;
}

.section-card__header {
  margin-bottom: 16px;
}

.calendar-list {
  margin-top: 18px;
}

.calendar-form,
.invite-form {
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
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

input[type="color"] {
  padding: 5px;
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

.button:disabled,
input:disabled,
select:disabled {
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

.calendar-card__title,
.invite-card,
.member-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.calendar-card__title {
  margin-bottom: 16px;
}

.calendar-card__color {
  flex: 0 0 auto;
  width: 16px;
  height: 48px;
  border-radius: 999px;
  background: var(--calendar-color);
}

.calendar-card h3 {
  margin-bottom: 4px;
  font-size: 1.35rem;
}

.inline-actions,
.member-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.members-panel {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--color-line);
}

.members-panel h4 {
  margin-bottom: 10px;
}

.member-list {
  display: grid;
  gap: 10px;
}

.invite-card,
.member-row {
  padding: 12px;
  border-radius: 8px;
  background: #f8fafc;
}

.invite-card strong,
.member-row strong {
  display: block;
}

.member-row__actions select {
  min-height: 42px;
}

@media (min-width: 760px) {
  .calendar-tool {
    padding: 34px 0 44px;
  }

  .calendar-form {
    grid-template-columns: 1fr 180px 120px auto;
    align-items: end;
  }

  .calendar-form--compact {
    grid-template-columns: 1fr 170px 110px auto;
  }

  .invite-form {
    grid-template-columns: 1fr 150px auto;
    align-items: end;
  }

  .section-card,
  .calendar-card {
    padding: 24px;
  }
}
</style>
