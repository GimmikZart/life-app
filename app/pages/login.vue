<script setup lang="ts">
definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

async function login() {
  errorMessage.value = ''
  isSubmitting.value = true

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
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
  <AuthCard
    title="Accedi"
    footer-text="Non hai ancora un account?"
    footer-link-label="Registrati"
    footer-link-to="/signup"
  >
    <form class="auth-form" @submit.prevent="login">
      <label>
        Email
        <input v-model="email" type="email" autocomplete="email" required>
      </label>

      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required>
      </label>

      <p v-if="errorMessage" class="auth-form__error" role="alert">
        {{ errorMessage }}
      </p>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Accesso in corso...' : 'Accedi' }}
      </button>
    </form>
  </AuthCard>
</template>

<style scoped>
.auth-form {
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 8px;
  color: #374151;
  font-weight: 600;
}

input {
  min-height: 52px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  background: #ffffff;
  font: inherit;
  font-size: 1rem;
}

button {
  min-height: 54px;
  border: 0;
  border-radius: 18px;
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
</style>
