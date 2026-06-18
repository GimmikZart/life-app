<script setup lang="ts">
const route = useRoute()
const navigationItems = useCoreNavigation()
</script>

<template>
  <nav class="bottom-nav" aria-label="Navigazione principale mobile">
    <NuxtLink
      v-for="item in navigationItems"
      :key="item.path"
      class="bottom-nav__link"
      :class="{ 'bottom-nav__link--active': route.path === item.path }"
      :to="item.path"
    >
      <span class="bottom-nav__dot" aria-hidden="true" />
      <span class="bottom-nav__label">{{ item.shortLabel }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  right: max(12px, env(safe-area-inset-right));
  bottom: max(12px, env(safe-area-inset-bottom));
  left: max(12px, env(safe-area-inset-left));
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  min-height: 68px;
  padding: 8px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(18px);
}

.bottom-nav__link {
  display: grid;
  min-width: 0;
  min-height: 52px;
  place-items: center;
  align-content: center;
  gap: 5px;
  border-radius: 18px;
  color: var(--color-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-decoration: none;
  touch-action: manipulation;
}

.bottom-nav__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.28;
}

.bottom-nav__label {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottom-nav__link--active {
  background: #111827;
  color: #ffffff;
}

.bottom-nav__link--active .bottom-nav__dot {
  opacity: 1;
}

@media (min-width: 760px) {
  .bottom-nav {
    display: none;
  }
}
</style>
