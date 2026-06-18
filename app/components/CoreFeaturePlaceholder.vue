<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <main class="placeholder-page">
    <section class="placeholder-page__content">
      <p class="placeholder-page__eyebrow">Coming soon</p>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </section>
  </main>
</template>

<style scoped>
.placeholder-page {
  width: min(960px, calc(100% - 32px));
  margin: 0 auto;
  padding: 56px 0;
}

.placeholder-page__content {
  max-width: 640px;
}

.placeholder-page__eyebrow {
  margin: 0 0 8px;
  color: var(--color-accent);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: clamp(2rem, 6vw, 3.2rem);
  line-height: 1.05;
}

p {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.7;
}
</style>
