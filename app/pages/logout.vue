<script setup lang="ts">
definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()

onMounted(async () => {
  await supabase.auth.signOut()
  await navigateTo('/login')
})
</script>

<template>
  <main class="logout-page">
    <p>Disconnessione in corso...</p>
  </main>
</template>

<style scoped>
.logout-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  color: #4b5563;
}
</style>
