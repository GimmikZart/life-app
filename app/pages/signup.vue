<script setup lang="ts">
const supabase = useSupabaseClient()

const name = ref('')
const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

async function signup() {
  errorMessage.value = ''
  isSubmitting.value = true

  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: {
        name: name.value
      }
    }
  })

  isSubmitting.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  await navigateTo('/')
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel" aria-labelledby="signup-title">
      <p class="auth-panel__eyebrow">Life App</p>
      <h1 id="signup-title">Crea account</h1>

      <form class="auth-form" @submit.prevent="signup">
        <label>
          Nome
          <input v-model="name" type="text" autocomplete="name">
        </label>

        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" required>
        </label>

        <label>
          Password
          <input v-model="password" type="password" autocomplete="new-password" minlength="6" required>
        </label>

        <p v-if="errorMessage" class="auth-form__error" role="alert">
          {{ errorMessage }}
        </p>

        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creazione in corso...' : 'Registrati' }}
        </button>
      </form>

      <p class="auth-panel__footer">
        Hai gia un account?
        <NuxtLink to="/login">Accedi</NuxtLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
}

.auth-panel {
  width: min(100%, 420px);
  padding: 28px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.auth-panel__eyebrow {
  margin: 0 0 8px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #2563eb;
}

h1 {
  margin: 0 0 24px;
  font-size: 2rem;
}

.auth-form {
  display: grid;
  gap: 16px;
}

label {
  display: grid;
  gap: 8px;
  color: #374151;
  font-weight: 600;
}

input {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.auth-form__error {
  margin: 0;
  color: #b91c1c;
}

.auth-panel__footer {
  margin: 20px 0 0;
  color: #4b5563;
}

a {
  color: #2563eb;
  font-weight: 700;
}
</style>
