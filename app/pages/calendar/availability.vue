<script setup lang="ts">
type Connection = {
  id: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
}

type RelationshipsResponse = { connections: Connection[]; incomingRequests: unknown[]; outgoingRequests: unknown[] }

type Participant = { id: string; name: string | null; email: string }
type AvailabilityOccurrence = {
  id: string
  ownerUserId: string
  title: string
  startAt: string
  endAt: string
  busy: boolean
}
type AvailabilityResponse = { participants: Participant[]; occurrences: AvailabilityOccurrence[] }

type RangePreset = 'week' | 'month' | 'nextMonth' | 'custom'

const palette = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#dc2626']

const { user } = useUser()
const myId = computed(() => user.value?.id ?? '')

const { data: relationshipData } = await useFetch<RelationshipsResponse>('/api/relationships', {
  default: () => ({ connections: [], incomingRequests: [], outgoingRequests: [] })
})
const connections = computed(() => relationshipData.value?.connections ?? [])

const selectedUserIds = ref<string[]>([])
const rangePreset = ref<RangePreset>('week')
const customFrom = ref(formatDateInput(new Date()))
const customTo = ref(formatDateInput(addDays(new Date(), 14)))

// Controlli del finder di slot liberi.
const dayStart = ref('09:00')
const dayEnd = ref('21:00')
const minDuration = ref(60)
const showSlots = ref(false)

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

  return {
    from: new Date(`${customFrom.value}T00:00:00`),
    to: new Date(`${customTo.value}T23:59:59.999`)
  }
})

const availabilityQuery = computed(() => ({
  userIds: selectedUserIds.value.join(','),
  from: range.value.from.toISOString(),
  to: range.value.to.toISOString()
}))

const { data, pending } = await useFetch<AvailabilityResponse>('/api/availability', {
  query: availabilityQuery,
  default: () => ({ participants: [], occurrences: [] })
})

const participantColor = computed(() => {
  const map = new Map<string, string>()
  const ordered = [myId.value, ...(data.value?.participants ?? []).map((p) => p.id).filter((id) => id !== myId.value)]
  ordered.forEach((id, index) => map.set(id, palette[index % palette.length] ?? '#2563eb'))

  return map
})

function participantLabel(id: string) {
  if (id === myId.value) {
    return 'Tu'
  }

  const participant = (data.value?.participants ?? []).find((p) => p.id === id)

  return participant?.name || participant?.email || 'Utente'
}

// Impegni di tutti raggruppati per giorno (per l'overlay testuale).
const eventsByDay = computed(() => groupByDay(
  (data.value?.occurrences ?? []).slice().sort((a, b) => a.startAt.localeCompare(b.startAt)),
  (occurrence) => occurrence.startAt
))

// Slot liberi comuni calcolati lato client (conosce il fuso locale).
const freeSlots = computed(() => {
  if (!showSlots.value) {
    return []
  }

  const busy = (data.value?.occurrences ?? []).map((occurrence) => [
    new Date(occurrence.startAt).getTime(),
    new Date(occurrence.endAt).getTime()
  ] as [number, number])

  return computeFreeSlots(busy, range.value.from, range.value.to, dayStart.value, dayEnd.value, minDuration.value)
})

const freeSlotsByDay = computed(() => groupByDay(freeSlots.value, (slot) => slot.start))

function toggleUser(userId: string) {
  selectedUserIds.value = selectedUserIds.value.includes(userId)
    ? selectedUserIds.value.filter((id) => id !== userId)
    : [...selectedUserIds.value, userId]
}

function computeFreeSlots(
  busy: [number, number][],
  from: Date,
  to: Date,
  startHHMM: string,
  endHHMM: string,
  minMinutes: number
) {
  const [startHour, startMin] = startHHMM.split(':').map(Number)
  const [endHour, endMin] = endHHMM.split(':').map(Number)
  const minMs = Math.max(15, minMinutes) * 60_000
  const slots: { start: string; end: string }[] = []

  let day = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const lastDay = new Date(to.getFullYear(), to.getMonth(), to.getDate())

  while (day <= lastDay) {
    const windowStart = new Date(day)
    windowStart.setHours(startHour ?? 0, startMin ?? 0, 0, 0)
    const windowEnd = new Date(day)
    windowEnd.setHours(endHour ?? 0, endMin ?? 0, 0, 0)

    const ws = windowStart.getTime()
    const we = windowEnd.getTime()

    if (we > ws) {
      const dayBusy = busy
        .filter(([bs, be]) => be > ws && bs < we)
        .map(([bs, be]) => [Math.max(bs, ws), Math.min(be, we)] as [number, number])
        .sort((a, b) => a[0] - b[0])

      const merged: [number, number][] = []
      for (const interval of dayBusy) {
        const last = merged[merged.length - 1]
        if (last && interval[0] <= last[1]) {
          last[1] = Math.max(last[1], interval[1])
        } else {
          merged.push([...interval])
        }
      }

      let cursor = ws
      for (const [bs, be] of merged) {
        if (bs - cursor >= minMs) {
          slots.push({ start: new Date(cursor).toISOString(), end: new Date(bs).toISOString() })
        }
        cursor = Math.max(cursor, be)
      }
      if (we - cursor >= minMs) {
        slots.push({ start: new Date(cursor).toISOString(), end: new Date(we).toISOString() })
      }
    }

    day = addDays(day, 1)
  }

  return slots
}

function groupByDay<T>(items: T[], getStart: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const date = new Date(getStart(item))
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const bucket = groups.get(key) ?? []
    bucket.push(item)
    groups.set(key, bucket)
  }

  return [...groups.entries()].map(([key, value]) => ({ key, label: dayLabel(value, getStart), items: value }))
}

function dayLabel<T>(items: T[], getStart: (item: T) => string) {
  return new Date(getStart(items[0] as T)).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
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
  const day = (result.getDay() + 6) % 7 // lunedì = 0

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
  <main class="availability">
    <header class="availability__header">
      <p class="availability__eyebrow">Calendario</p>
      <h1>Confronta disponibilità</h1>
      <p class="availability__hint">
        Scegli con chi confrontarti e il periodo, poi trova al volo gli slot liberi per tutti.
        Per gruppi temporanei usa le room.
      </p>
      <NuxtLink class="rooms-link" to="/calendar/rooms">Le mie room →</NuxtLink>
    </header>

    <section class="control-card">
      <h2>Con chi</h2>
      <p v-if="!connections.length" class="empty-state">
        Non hai ancora relazioni. Aggiungine una dal menu in alto a destra per confrontare le disponibilità.
      </p>
      <div v-else class="chips">
        <span class="chip chip--me">Tu</span>
        <button
          v-for="connection in connections"
          :key="connection.targetUserId"
          type="button"
          class="chip"
          :class="{ 'chip--active': selectedUserIds.includes(connection.targetUserId) }"
          @click="toggleUser(connection.targetUserId)"
        >
          {{ connection.targetName || connection.targetEmail }}
        </button>
      </div>
    </section>

    <section class="control-card">
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

    <section class="control-card control-card--accent">
      <h2>Slot liberi</h2>
      <div class="slot-controls">
        <label>Dalle <input v-model="dayStart" type="time"></label>
        <label>Alle <input v-model="dayEnd" type="time"></label>
        <label>Durata min. (min) <input v-model.number="minDuration" type="number" min="15" step="15"></label>
      </div>
      <button class="button button--primary" type="button" @click="showSlots = true">Trova slot liberi</button>

      <template v-if="showSlots">
        <p v-if="!freeSlots.length" class="empty-state">Nessuno slot libero comune nel periodo e nella fascia selezionata.</p>
        <div v-for="group in freeSlotsByDay" :key="group.key" class="day-group">
          <h3>{{ group.label }}</h3>
          <span v-for="(slot, index) in group.items" :key="index" class="slot-pill">
            {{ timeLabel(slot.start) }}–{{ timeLabel(slot.end) }}
          </span>
        </div>
      </template>
    </section>

    <section class="control-card">
      <h2>Impegni di tutti</h2>
      <p v-if="pending" class="empty-state">Carico le disponibilità...</p>
      <p v-else-if="!data.occurrences.length" class="empty-state">Nessun impegno nel periodo selezionato.</p>

      <div v-for="group in eventsByDay" :key="group.key" class="day-group">
        <h3>{{ group.label }}</h3>
        <article v-for="occurrence in group.items" :key="occurrence.id" class="busy-row">
          <span class="busy-row__dot" :style="{ backgroundColor: participantColor.get(occurrence.ownerUserId) }" aria-hidden="true" />
          <span class="busy-row__time">{{ timeLabel(occurrence.startAt) }}–{{ timeLabel(occurrence.endAt) }}</span>
          <span class="busy-row__title">{{ occurrence.title }}</span>
          <span class="busy-row__who">{{ participantLabel(occurrence.ownerUserId) }}</span>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.availability {
  width: min(100% - (var(--shell-inline-padding) * 2), 820px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.availability__header {
  margin-bottom: 16px;
}

.availability__eyebrow {
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
  font-size: 1.05rem;
}

h3 {
  margin: 14px 0 8px;
  font-size: 0.95rem;
  text-transform: capitalize;
}

.availability__hint,
.empty-state,
.busy-row__who {
  color: var(--color-muted);
  line-height: 1.5;
}

.rooms-link {
  display: inline-flex;
  margin-top: 10px;
  font-weight: 900;
  color: var(--color-accent);
  text-decoration: none;
}

.control-card {
  margin-top: 14px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.control-card--accent {
  background: #f8fafc;
}

.chips,
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip,
.preset {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: #ffffff;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.chip--active,
.preset--active {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: #ffffff;
}

.chip--me {
  background: #e0ecff;
  border-color: #c7dbff;
  color: #174ea6;
  cursor: default;
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

@media (min-width: 760px) {
  .availability {
    padding: 34px 0 44px;
  }
}
</style>
