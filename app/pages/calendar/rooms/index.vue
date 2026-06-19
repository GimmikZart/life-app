<script setup lang="ts">
type RoomItem = {
  id: string
  token: string
  title: string | null
  expiresAt: string | null
  isCreator: boolean
}

const { data, refresh } = await useFetch<{ rooms: RoomItem[] }>('/api/rooms', {
  default: () => ({ rooms: [] })
})

const form = reactive({ title: '', durationHours: 24 })
const errorMessage = ref('')
const isSubmitting = ref(false)

async function createRoom() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    const result = await $fetch<{ room: { token: string } }>('/api/rooms', {
      method: 'POST',
      body: { title: form.title || null, durationHours: form.durationHours }
    })

    await navigateTo(`/calendar/rooms/${result.room.token}`)
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? 'Creazione room non riuscita.'
    await refresh()
  } finally {
    isSubmitting.value = false
  }
}

function expiryLabel(value: string | null) {
  if (!value) {
    return 'senza scadenza'
  }

  return `scade il ${new Date(value).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
}
</script>

<template>
  <main class="rooms">
    <header class="rooms__header">
      <p class="rooms__eyebrow">Calendario</p>
      <h1>Le mie room</h1>
      <p class="rooms__hint">
        Una room è un confronto disponibilità momentaneo: invita persone con un link,
        vedete gli impegni di tutti e trovate al volo gli slot liberi.
      </p>
    </header>

    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <section class="card">
      <h2>Crea una room</h2>
      <form class="room-form" @submit.prevent="createRoom">
        <label>
          Nome (opzionale)
          <input v-model="form.title" type="text" placeholder="Es. Serata con gli amici">
        </label>
        <label>
          Durata (ore)
          <input v-model.number="form.durationHours" type="number" min="1" max="720" step="1">
        </label>
        <button class="button button--primary" type="submit" :disabled="isSubmitting">Crea e apri</button>
      </form>
    </section>

    <section class="rooms__section">
      <h2>Room attive</h2>
      <p v-if="!data.rooms.length" class="empty-state">Nessuna room attiva.</p>

      <NuxtLink
        v-for="room in data.rooms"
        :key="room.id"
        class="room-card"
        :to="`/calendar/rooms/${room.token}`"
      >
        <div class="room-card__body">
          <strong>
            {{ room.title || 'Room senza nome' }}
            <span v-if="room.isCreator" class="badge">Creata da te</span>
          </strong>
          <span>{{ expiryLabel(room.expiresAt) }}</span>
        </div>
        <span class="room-card__chevron" aria-hidden="true">›</span>
      </NuxtLink>
    </section>
  </main>
</template>

<style scoped>
.rooms {
  width: min(100% - (var(--shell-inline-padding) * 2), 720px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.rooms__header {
  margin-bottom: 16px;
}

.rooms__eyebrow {
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

.rooms__hint,
.empty-state,
.room-card__body span {
  color: var(--color-muted);
  line-height: 1.5;
}

.card,
.rooms__section {
  margin-top: 16px;
}

.card {
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.room-form {
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

input {
  min-height: 50px;
  padding: 0 13px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.button {
  min-height: 50px;
  padding: 0 18px;
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

.room-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding: 14px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
  color: var(--color-ink);
  text-decoration: none;
}

.room-card__body {
  display: grid;
  gap: 3px;
  flex: 1 1 auto;
  min-width: 0;
}

.room-card__body strong {
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

.room-card__chevron {
  color: var(--color-muted);
  font-size: 1.6rem;
  line-height: 1;
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
  .rooms {
    padding: 34px 0 44px;
  }

  .room-form {
    grid-template-columns: 1fr 140px auto;
    align-items: end;
  }
}
</style>
