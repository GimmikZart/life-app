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
  myIsPrimary: boolean
  myAutoIntegrate: boolean
  members: CalendarMember[]
}

type CalendarResponse = {
  calendars: CalendarItem[]
  receivedInvites: unknown[]
  sentInvites: unknown[]
}

const calendarTypes: { value: CalendarType; label: string }[] = [
  { value: 'personal', label: 'Personale' },
  { value: 'couple', label: 'Coppia' },
  { value: 'family', label: 'Famiglia' },
  { value: 'work', label: 'Lavoro' },
  { value: 'custom', label: 'Custom' }
]
const memberPermissions: { value: 'editor' | 'viewer'; label: string }[] = [
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' }
]

const route = useRoute()
const calendarId = computed(() => String(route.params.id))

const { data, refresh } = await useFetch<CalendarResponse>('/api/calendars', {
  default: () => ({ calendars: [], receivedInvites: [], sentInvites: [] })
})

const calendar = computed(() =>
  (data.value?.calendars ?? []).find((item) => item.id === calendarId.value && item.myStatus === 'accepted') ?? null
)
const isOwner = computed(() => calendar.value?.myPermission === 'owner')
const canEdit = computed(() => calendar.value?.myPermission === 'owner' || calendar.value?.myPermission === 'editor')

const editForm = reactive({ name: '', color: '#2563eb', type: 'personal' as CalendarType })
const inviteForm = reactive({ email: '', permission: 'viewer' as 'editor' | 'viewer' })
const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

watchEffect(() => {
  if (calendar.value) {
    editForm.name = calendar.value.name
    editForm.color = calendar.value.color
    editForm.type = calendar.value.type
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

function updateCalendar() {
  return runAction(async () => {
    await $fetch(`/api/calendars/${calendarId.value}`, {
      method: 'PATCH',
      body: { name: editForm.name, color: editForm.color, type: editForm.type }
    })
    await refresh()

    return 'Calendario aggiornato.'
  })
}

function deleteCalendar() {
  return runAction(async () => {
    await $fetch(`/api/calendars/${calendarId.value}`, { method: 'DELETE' })
    await navigateTo('/calendar/manage')

    return 'Calendario eliminato.'
  })
}

function setPrimary() {
  return runAction(async () => {
    await $fetch(`/api/calendars/${calendarId.value}/preferences`, { method: 'PATCH', body: { isPrimary: true } })
    await refresh()

    return 'Impostato come primario.'
  })
}

function toggleAutoIntegrate() {
  const next = !calendar.value?.myAutoIntegrate

  return runAction(async () => {
    await $fetch(`/api/calendars/${calendarId.value}/preferences`, { method: 'PATCH', body: { autoIntegrate: next } })
    await refresh()

    return 'Integrazione aggiornata.'
  })
}

function inviteMember() {
  return runAction(async () => {
    await $fetch(`/api/calendars/${calendarId.value}/members`, { method: 'POST', body: inviteForm })
    inviteForm.email = ''
    inviteForm.permission = 'viewer'
    await refresh()

    return 'Invito inviato.'
  })
}

function updateMember(member: CalendarMember) {
  return runAction(async () => {
    await $fetch(`/api/calendars/${calendarId.value}/members/${member.userId}`, {
      method: 'PATCH',
      body: { permission: member.permission }
    })
    await refresh()

    return 'Ruolo aggiornato.'
  })
}

function removeMember(member: CalendarMember) {
  return runAction(async () => {
    await $fetch(`/api/calendars/${calendarId.value}/members/${member.userId}` as string, { method: 'DELETE' })
    await refresh()

    return 'Membro rimosso.'
  })
}
</script>

<template>
  <main class="cal-detail">
    <header class="cal-detail__header">
      <NuxtLink class="back-link" to="/calendar/manage">Torna ai calendari</NuxtLink>
      <p class="cal-detail__eyebrow">Calendario</p>
      <h1>{{ calendar?.name || 'Calendario' }}</h1>
    </header>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <p v-if="!calendar" class="empty-state">Calendario non trovato.</p>

    <template v-else>
      <section class="detail-card">
        <h2>Dettagli</h2>
        <form class="detail-form" @submit.prevent="updateCalendar">
          <label>
            Nome
            <input v-model="editForm.name" type="text" required :disabled="!canEdit">
          </label>
          <label>
            Tipo
            <select v-model="editForm.type" :disabled="!canEdit">
              <option v-for="type in calendarTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
            </select>
          </label>
          <label>
            Colore
            <input v-model="editForm.color" type="color" :disabled="!canEdit">
          </label>
          <button class="button button--primary" type="submit" :disabled="isSubmitting || !canEdit">Salva</button>
        </form>
      </section>

      <section class="detail-card">
        <h2>Integrazione</h2>
        <div class="layer-prefs">
          <button v-if="!calendar.myIsPrimary && isOwner" class="button button--ghost" type="button" :disabled="isSubmitting" @click="setPrimary">
            Imposta come primario
          </button>
          <span v-else-if="calendar.myIsPrimary" class="badge">Calendario primario</span>

          <label class="toggle" :class="{ 'toggle--locked': calendar.myIsPrimary }">
            <input type="checkbox" :checked="calendar.myAutoIntegrate" :disabled="isSubmitting || calendar.myIsPrimary" @change="toggleAutoIntegrate">
            <span>Integra nella vista ufficiale</span>
          </label>
        </div>
      </section>

      <section v-if="isOwner" class="detail-card">
        <h2>Membri</h2>
        <form class="invite-form" @submit.prevent="inviteMember">
          <input v-model="inviteForm.email" type="email" placeholder="email utente registrato" required>
          <select v-model="inviteForm.permission">
            <option v-for="permission in memberPermissions" :key="permission.value" :value="permission.value">{{ permission.label }}</option>
          </select>
          <button class="button button--secondary" type="submit" :disabled="isSubmitting">Invita</button>
        </form>

        <article v-for="member in calendar.members" :key="member.userId" class="member-row">
          <div class="member-row__body">
            <strong>{{ member.name || member.email }}</strong>
            <span>{{ member.email }} · {{ member.status }}</span>
          </div>
          <div class="member-row__actions">
            <select v-model="member.permission" :disabled="member.permission === 'owner'" @change="updateMember(member)">
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button v-if="member.permission !== 'owner'" class="button button--ghost" type="button" :disabled="isSubmitting" @click="removeMember(member)">
              Rimuovi
            </button>
          </div>
        </article>
      </section>

      <section v-if="isOwner" class="detail-card detail-card--danger">
        <button class="button button--danger" type="button" :disabled="isSubmitting" @click="deleteCalendar">Elimina calendario</button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.cal-detail {
  width: min(100% - (var(--shell-inline-padding) * 2), 680px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.cal-detail__header {
  margin-bottom: 18px;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.cal-detail__eyebrow {
  margin: 14px 0 6px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 2rem;
  line-height: 1.05;
}

h2 {
  margin: 0 0 12px;
  font-size: 1.1rem;
}

.empty-state,
.member-row__body span {
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

.detail-form,
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
  border-radius: 10px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

input[type="color"] {
  padding: 5px;
}

input:disabled,
select:disabled,
.button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.layer-prefs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.toggle input {
  width: 18px;
  height: 18px;
  min-height: 0;
  margin: 0;
}

.toggle--locked {
  opacity: 0.62;
  cursor: not-allowed;
}

.badge {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--color-ink);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 900;
}

.member-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.member-row__body {
  display: grid;
  gap: 2px;
}

.member-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.member-row__actions select {
  min-height: 42px;
  width: auto;
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
  .cal-detail {
    padding: 34px 0 44px;
  }

  .invite-form {
    grid-template-columns: 1fr 150px auto;
    align-items: end;
  }
}
</style>
