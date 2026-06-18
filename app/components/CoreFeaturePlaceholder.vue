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
  display: grid;
  width: min(100% - (var(--shell-inline-padding) * 2), 960px);
  min-height: calc(100svh - 64px - var(--shell-bottom-nav-space));
  margin: 0 auto;
  padding: 20px 0 28px;
  align-items: center;
}

.placeholder-page__content {
  max-width: 640px;
  padding: 24px 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-soft);
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
  font-size: clamp(2.15rem, 13vw, 4.2rem);
  line-height: 0.92;
  letter-spacing: -0.06em;
}

p {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.7;
}

@media (min-width: 760px) {
  .placeholder-page {
    min-height: calc(100vh - 74px);
    padding: 48px 0;
  }

  .placeholder-page__content {
    padding: 34px;
  }
}
</style>
