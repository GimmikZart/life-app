<script setup lang="ts">
type VisibilityMode = 'clear' | 'busy' | 'hide_category'

const modes: { value: VisibilityMode; label: string }[] = [
  { value: 'busy', label: 'Solo "occupato" (consigliato)' },
  { value: 'clear', label: 'Mostra tutto in chiaro' },
  { value: 'hide_category', label: 'Mostra tutto tranne una categoria' }
]

const form = reactive({
  targetEmail: '',
  relationshipType: '',
  mode: 'busy' as VisibilityMode,
  hiddenCategory: ''
})
const errorMessage = ref('')
const isSubmitting = ref(false)

async function invite() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await $fetch('/api/relationships', {
      method: 'POST',
      body: {
        targetEmail: form.targetEmail,
        relationshipType: form.relationshipType,
        visibilityRules: {
          mode: form.mode,
          hiddenCategory: form.hiddenCategory || null
        }
      }
    })

    await navigateTo('/calendar/relations')
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? (error instanceof Error ? error.message : 'Invito non riuscito.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="invite">
    <header class="invite__header">
      <NuxtLink class="back-link" to="/calendar/relations">Torna alle relazioni</NuxtLink>
      <p class="invite__eyebrow">Relazioni</p>
      <h1>Aggiungi relazione</h1>
      <p class="invite__hint">
        La persona deve essere gia registrata. Riceverà una richiesta da accettare:
        di default vedrà solo quando sei "occupato", senza dettagli.
      </p>
    </header>

    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <form class="invite-form" @submit.prevent="invite">
      <label>
        Email della persona
        <input v-model="form.targetEmail" type="email" placeholder="utente@esempio.it" required>
      </label>
      <label>
        Tipo di relazione
        <input v-model="form.relationshipType" type="text" placeholder="Partner, amico, famiglia..." required>
      </label>
      <label>
        Cosa puo vedere dei tuoi eventi
        <select v-model="form.mode">
          <option v-for="mode in modes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
        </select>
      </label>
      <label v-if="form.mode === 'hide_category'">
        Categoria da nascondere
        <input v-model="form.hiddenCategory" type="text" placeholder="Es. lavoro" required>
      </label>
      <button class="button button--primary" type="submit" :disabled="isSubmitting">Invia richiesta</button>
    </form>
  </main>
</template>

<style scoped>
.invite {
  width: min(100% - (var(--shell-inline-padding) * 2), 620px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.invite__header {
  margin-bottom: 18px;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.invite__eyebrow {
  margin: 14px 0 6px;
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

.invite__hint {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.5;
}

.invite-form {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 14px;
  background: #ffffff;
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
  border-radius: 10px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.button {
  min-height: 50px;
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
  .invite {
    padding: 34px 0 44px;
  }
}
</style>
