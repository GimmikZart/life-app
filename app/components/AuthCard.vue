<script setup lang="ts">
const props = defineProps<{
  title: string
  footerText: string
  footerLinkLabel: string
  footerLinkTo: string
}>()

const titleId = computed(() => `${props.title.toLowerCase().replace(/\s+/g, '-')}-title`)
</script>

<template>
  <main class="auth-page">
    <section class="auth-card" :aria-labelledby="titleId">
      <p class="auth-card__eyebrow">Life App</p>
      <h1 :id="titleId">{{ title }}</h1>

      <slot />

      <p class="auth-card__footer">
        {{ footerText }}
        <NuxtLink :to="footerLinkTo">{{ footerLinkLabel }}</NuxtLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  display: grid;
  min-height: 100svh;
  align-items: end;
  padding: 20px 14px max(18px, env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 12% 10%, rgba(37, 99, 235, 0.16), transparent 30%),
    linear-gradient(180deg, #eef4ff 0%, #f8fafc 44%, #ffffff 100%);
}

.auth-card {
  width: min(100%, 460px);
  margin: 0 auto;
  padding: 24px 18px 18px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
}

.auth-card__eyebrow {
  margin: 0 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 22px;
  font-size: clamp(2rem, 12vw, 2.9rem);
  line-height: 0.95;
}

.auth-card__footer {
  margin: 18px 0 0;
  color: var(--color-muted);
  font-size: 0.95rem;
  line-height: 1.5;
}

a {
  color: var(--color-accent);
  font-weight: 900;
}

@media (min-width: 680px) {
  .auth-page {
    align-items: center;
    padding: 32px;
  }

  .auth-card {
    padding: 32px;
    border-radius: 32px;
  }
}
</style>
