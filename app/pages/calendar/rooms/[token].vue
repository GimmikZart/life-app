<script setup lang="ts">
type Participant = { userId: string; visibility: 'clear' | 'busy'; name: string | null; email: string }
type RoomResponse = {
  room: { id: string; token: string; title: string | null; expiresAt: string | null; isCreator: boolean }
  expired: boolean
  isParticipant: boolean
  myVisibility: 'clear' | 'busy' | null
  participants: Participant[]
}
type AvailabilityOccurrence = { id: string; ownerUserId: string; title: string; startAt: string; endAt: string; busy: boolean }
type AvailabilityResponse = {
  participants: { id: string; name: string | null; email: string; visibility: 'clear' | 'busy' }[]
  occurrences: AvailabilityOccurrence[]
}
type RangePreset = 'week' | 'month' | 'nextMonth' | 'custom'

const palette = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#dc2626']

const route = useRoute()
const token = computed(() => String(route.params.token))
const { computeFreeSlots, groupByDay } = useFreeSlots()

const { data: roomData, refresh: refreshRoom } = await useFetch<RoomResponse>(() => `/api/rooms/${token.value}`, {
  default: () => ({
    room: { id: '', token: '', title: null, expiresAt: null, isCreator: false },
    expired: false,
    isParticipant: false,
    myVisibility: null,
    participants: []
  })
})

const availability = ref<AvailabilityResponse>({ participants: [], occurrences: [] })
const rangePreset = ref<RangePreset>('week')
const customFrom = ref(formatDateInput(new Date()))
const customTo = ref(formatDateInput(addDays(new Date(), 14)))
const dayStart = ref('09:00')
const dayEnd = ref('21:00')
const minDuration = ref(60)
const showSlots = ref(false)
const isBusy = ref(false)
const message = ref('')
const copied = ref(false)

const isParticipant = computed(() => roomData.value?.isParticipant ?? false)
const expired = computed(() => roomData.value?.expired ?? false)

const shareLink = computed(() => (import.meta.client ? `${window.location.origin}/calendar/rooms/${token.value}` : ''))

const range = computed(() => {
  const now = new Date()
  if (rangePreset.value === 'week') {
    const start = startOfWeek(now)

    return { from: start, to: endOfLocalDay(addDays(start, 6)) }
  }
  if (rangePreset.value === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfLocalDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  }
  if (rangePreset.value === 'nextMonth') {
    return { from: new Date(now.getFullYear(), now.getMonth() + 1, 1), to: endOfLocalDay(new Date(now.getFullYear(), now.getMonth() + 2, 0)) }
  }

  return { from: new Date(`${customFrom.value}T00:00:00`), to: new Date(`${customTo.value}T23:59:59.999`) }
})

const participantColor = computed(() => {
  const map = new Map<string, string>()
  availability.value.participants.forEach((participant, index) => map.set(participant.id, palette[index % palette.length] ?? '#2563eb'))

  return map
})

const eventsByDay = computed(() => groupByDay(
  availability.value.occurrences.slice().sort((a, b) => a.startAt.localeCompare(b.startAt)),
  (occurrence) => occurrence.startAt
))

const freeSlots = computed(() => {
  if (!showSlots.value) {
    return []
  }

  const busy = availability.value.occurrences.map((occurrence) => [
    new Date(occurrence.startAt).getTime(),
    new Date(occurrence.endAt).getTime()
  ] as [number, number])

  return computeFreeSlots(busy, range.value.from, range.value.to, dayStart.value, dayEnd.value, minDuration.value)
})
const freeSlotsByDay = computed(() => groupByDay(freeSlots.value, (slot) => slot.start))

async function loadAvailability() {
  if (!isParticipant.value || expired.value) {
    return
  }

  try {
    availability.value = await $fetch<AvailabilityResponse>(`/api/rooms/${token.value}/availability`, {
      query: { from: range.value.from.toISOString(), to: range.value.to.toISOString() }
    })
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    message.value = fetchError?.data?.statusMessage ?? 'Impossibile caricare la room.'
  }
}

watch([isParticipant, range], loadAvailability, { immediate: true })

async function joinRoom() {
  isBusy.value = true
  message.value = ''

  try {
    await $fetch(`/api/rooms/${token.value}/join`, { method: 'POST' })
    await refreshRoom()
    await loadAvailability()
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    message.value = fetchError?.data?.statusMessage ?? 'Impossibile entrare nella room.'
  } finally {
    isBusy.value = false
  }
}

async function setMyVisibility(visibility: 'clear' | 'busy') {
  await $fetch(`/api/rooms/${token.value}/me`, { method: 'PATCH', body: { visibility } })
  await refreshRoom()
  await loadAvailability()
}

async function leaveRoom() {
  await $fetch(`/api/rooms/${token.value}/me` as string, { method: 'DELETE' })
  await navigateTo('/calendar/rooms')
}

function copyLink() {
  if (import.meta.client && navigator.clipboard) {
    navigator.clipboard.writeText(shareLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function participantName(userId: string) {
  const participant = availability.value.participants.find((item) => item.id === userId)

  return participant?.name || participant?.email || 'Utente'
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function formatDateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)

  return local.toISOString().slice(0, 10)
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (result.getDay() + 6) % 7

  return addDays(result, -day)
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)

  return next
}
</script>

<template>
  <main class="room">
    <header class="room__header">
      <NuxtLink class="back-link" to="/calendar/rooms">Torna alle room</NuxtLink>
      <p class="room__eyebrow">Room</p>
      <h1>{{ roomData.room.title || 'Room' }}</h1>
    </header>

    <p v-if="message" class="feedback feedback--error" role="alert">{{ message }}</p>

    <section v-if="expired" class="card">
      <p class="empty-state">Questa room è scaduta.</p>
    </section>

    <section v-else-if="!isParticipant" class="card">
      <h2>Entra nella room</h2>
      <p class="room__hint">Entrando, gli altri partecipanti potranno vedere la tua disponibilità (di default solo "occupato").</p>
      <button class="button button--primary" type="button" :disabled="isBusy" @click="joinRoom">Entra</button>
    </section>

    <template v-else>
      <section class="card">
        <h2>Invita</h2>
        <p class="room__hint">Condividi questo link: chi lo apre (ed è registrato) entra nella room.</p>
        <div class="share">
          <input :value="shareLink" type="text" readonly>
          <button class="button button--secondary" type="button" @click="copyLink">{{ copied ? 'Copiato!' : 'Copia' }}</button>
        </div>
      </section>

      <section class="card">
        <h2>Cosa vedono di me</h2>
        <div class="toggle-group">
          <button
            type="button"
            class="toggle"
            :class="{ 'toggle--active': roomData.myVisibility === 'busy' }"
            @click="setMyVisibility('busy')"
          >Solo occupato</button>
          <button
            type="button"
            class="toggle"
            :class="{ 'toggle--active': roomData.myVisibility === 'clear' }"
            @click="setMyVisibility('clear')"
          >Tutto in chiaro</button>
        </div>
        <p class="room__participants">
          Partecipanti: {{ roomData.participants.map((p) => p.name || p.email).join(', ') }}
        </p>
        <button class="button button--ghost" type="button" @click="leaveRoom">Esci dalla room</button>
      </section>

      <section class="card">
        <h2>Periodo</h2>
        <div class="presets">
          <button type="button" class="preset" :class="{ 'preset--active': rangePreset === 'week' }" @click="rangePreset = 'week'">Questa settimana</button>
          <button type="button" class="preset" :class="{ 'preset--active': rangePreset === 'month' }" @click="rangePreset = 'month'">Questo mese</button>
          <button type="button" class="preset" :class="{ 'preset--active': rangePreset === 'nextMonth' }" @click="rangePreset = 'nextMonth'">Mese prossimo</button>
          <button type="button" class="preset" :class="{ 'preset--active': rangePreset === 'custom' }" @click="rangePreset = 'custom'">Personalizzato</button>
        </div>
        <div v-if="rangePreset === 'custom'" class="custom-range">
          <label>Dal <input v-model="customFrom" type="date"></label>
          <label>Al <input v-model="customTo" type="date"></label>
        </div>
      </section>

      <section class="card card--accent">
        <h2>Slot liberi</h2>
        <div class="slot-controls">
          <label>Dalle <input v-model="dayStart" type="time"></label>
          <label>Alle <input v-model="dayEnd" type="time"></label>
          <label>Durata min. (min) <input v-model.number="minDuration" type="number" min="15" step="15"></label>
        </div>
        <button class="button button--primary" type="button" @click="showSlots = true">Trova slot liberi</button>

        <template v-if="showSlots">
          <p v-if="!freeSlots.length" class="empty-state">Nessuno slot libero comune nel periodo e nella fascia scelti.</p>
          <div v-for="group in freeSlotsByDay" :key="group.key" class="day-group">
            <h3>{{ group.label }}</h3>
            <span v-for="(slot, index) in group.items" :key="index" class="slot-pill">{{ timeLabel(slot.start) }}–{{ timeLabel(slot.end) }}</span>
          </div>
        </template>
      </section>

      <section class="card">
        <h2>Impegni di tutti</h2>
        <p v-if="!availability.occurrences.length" class="empty-state">Nessun impegno nel periodo selezionato.</p>
        <div v-for="group in eventsByDay" :key="group.key" class="day-group">
          <h3>{{ group.label }}</h3>
          <article v-for="occurrence in group.items" :key="occurrence.id" class="busy-row">
            <span class="busy-row__dot" :style="{ backgroundColor: participantColor.get(occurrence.ownerUserId) }" aria-hidden="true" />
            <span class="busy-row__time">{{ timeLabel(occurrence.startAt) }}–{{ timeLabel(occurrence.endAt) }}</span>
            <span class="busy-row__title">{{ occurrence.title }}</span>
            <span class="busy-row__who">{{ participantName(occurrence.ownerUserId) }}</span>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.room {
  width: min(100% - (var(--shell-inline-padding) * 2), 820px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.room__header {
  margin-bottom: 14px;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.room__eyebrow {
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
  font-size: 1.05rem;
}

h3 {
  margin: 14px 0 8px;
  font-size: 0.95rem;
  text-transform: capitalize;
}

.room__hint,
.room__participants,
.empty-state,
.busy-row__who {
  color: var(--color-muted);
  line-height: 1.5;
}

.card {
  margin-top: 14px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.card--accent {
  background: #f8fafc;
}

.share {
  display: flex;
  gap: 8px;
}

.share input {
  flex: 1 1 auto;
  min-width: 0;
}

.presets,
.toggle-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.custom-range,
.slot-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

label {
  display: grid;
  gap: 6px;
  color: #374151;
  font-size: 0.85rem;
  font-weight: 800;
}

input {
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.preset,
.toggle {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: #ffffff;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.preset--active,
.toggle--active {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: #ffffff;
}

.button {
  min-height: 48px;
  margin-top: 14px;
  padding: 0 18px;
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
  margin-top: 0;
  background: #e0ecff;
  color: #174ea6;
}

.button--ghost {
  border: 1px solid var(--color-line);
  background: #ffffff;
  color: var(--color-ink);
}

.day-group {
  margin-top: 6px;
}

.slot-pill {
  display: inline-flex;
  margin: 0 8px 8px 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-weight: 800;
}

.busy-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--color-line);
}

.busy-row__dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.busy-row__time {
  flex: 0 0 auto;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.busy-row__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.busy-row__who {
  flex: 0 0 auto;
  font-size: 0.82rem;
  font-weight: 800;
}

.feedback {
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  font-weight: 800;
}

.feedback--error {
  background: #fee2e2;
  color: #b91c1c;
}

@media (min-width: 760px) {
  .room {
    padding: 34px 0 44px;
  }
}
</style>
