<script setup lang="ts">
type CalendarType = 'personal' | 'couple' | 'family' | 'work' | 'custom'

const calendarTypes: { value: CalendarType; label: string }[] = [
  { value: 'personal', label: 'Personale' },
  { value: 'couple', label: 'Coppia' },
  { value: 'family', label: 'Famiglia' },
  { value: 'work', label: 'Lavoro' },
  { value: 'custom', label: 'Custom' }
]

const newCalendar = reactive({
  name: '',
  color: '#2563eb',
  type: 'personal' as CalendarType
})
const actionMessage = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? error.message
  }

  return 'Operazione non riuscita.'
}

async function createCalendar() {
  actionMessage.value = ''
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await $fetch('/api/calendars', {
      method: 'POST',
      body: newCalendar
    })

    newCalendar.name = ''
    newCalendar.color = '#2563eb'
    newCalendar.type = 'personal'
    actionMessage.value = 'Calendario creato.'
  } catch (error) {
    errorMessage.value = getActionErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="calendar-tool">
    <div class="calendar-tool__header">
      <NuxtLink class="back-link" to="/calendar">Torna al calendario</NuxtLink>
      <p class="calendar-tool__eyebrow">Nuovo</p>
      <h1>Crea calendario</h1>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">
      {{ actionMessage }}
    </p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">
      {{ errorMessage }}
    </p>

    <form class="calendar-form" @submit.prevent="createCalendar">
      <label>
        Nome
        <input v-model="newCalendar.name" type="text" placeholder="Es. Calendario famiglia" required>
      </label>

      <label>
        Tipo
        <select v-model="newCalendar.type">
          <option v-for="type in calendarTypes" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
        </select>
      </label>

      <label>
        Colore
        <input v-model="newCalendar.color" type="color">
      </label>

      <button class="button button--primary" type="submit" :disabled="isSubmitting">
        Crea calendario
      </button>
    </form>
  </section>
</template>

<style scoped>
.calendar-tool {
  width: min(100% - (var(--shell-inline-padding) * 2), 860px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.calendar-tool__header {
  margin-bottom: 18px;
}

.calendar-tool__eyebrow {
  margin: 16px 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
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

.calendar-form {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
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

.button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.button--primary {
  background: var(--color-ink);
  color: #ffffff;
}

.feedback {
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 8px;
  background: #ffffff;
  font-weight: 800;
}

.feedback--success {
  color: #166534;
}

.feedback--error {
  color: #b91c1c;
}

@media (min-width: 760px) {
  .calendar-tool {
    padding: 34px 0 44px;
  }

  .calendar-form {
    grid-template-columns: 1fr 180px 120px auto;
    align-items: end;
    padding: 24px;
  }
}
</style>
