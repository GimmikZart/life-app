<script setup lang="ts">
// Pagina di atterraggio del link di condivisione: unisce l'utente al calendario
// e lo porta al suo dettaglio. (L'auth è richiesta dal middleware globale.)
const route = useRoute()
const token = computed(() => String(route.params.token))
const errorMessage = ref('')
const joinedName = ref('')

onMounted(async () => {
  try {
    const result = await $fetch<{ calendarId: string; name: string }>(`/api/calendars/join/${token.value}`, {
      method: 'POST'
    })
    joinedName.value = result.name
    await navigateTo(`/calendar/manage/${result.calendarId}`)
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? 'Impossibile aprire il link.'
  }
})
</script>

<template>
  <main class="join">
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>
    <p v-else class="join__hint">Apertura del calendario condiviso{{ joinedName ? ` "${joinedName}"` : '' }}...</p>
    <NuxtLink v-if="errorMessage" class="join__back" to="/calendar">Torna al calendario</NuxtLink>
  </main>
</template>

<style scoped>
.join {
  width: min(100% - (var(--shell-inline-padding) * 2), 560px);
  margin: 0 auto;
  padding: 40px 0;
  text-align: center;
}

.join__hint {
  color: var(--color-muted);
  font-weight: 800;
}

.feedback {
  padding: 14px 16px;
  border-radius: 12px;
  font-weight: 800;
}

.feedback--error {
  background: #fee2e2;
  color: #b91c1c;
}

.join__back {
  display: inline-block;
  margin-top: 16px;
  color: var(--color-ink);
  font-weight: 900;
}
</style>
