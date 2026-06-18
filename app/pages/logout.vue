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
  min-height: 100svh;
  place-items: center;
  padding: 24px;
  color: #4b5563;
  background:
    radial-gradient(circle at 50% 20%, rgba(37, 99, 235, 0.14), transparent 22rem),
    #f8fafc;
}
</style>
