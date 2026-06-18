<script setup lang="ts">
const isOpen = ref(false)

const actions = [
  { label: 'Crea evento', to: '/calendar/create-event' },
  { label: 'Crea calendario', to: '/calendar/create' },
  { label: 'I miei calendari', to: '/calendar/manage' },
  { label: 'Relazioni', to: '/calendar/visibility' }
]
</script>

<template>
  <div class="speed-dial" :class="{ 'speed-dial--open': isOpen }">
    <div v-if="isOpen" class="speed-dial__actions">
      <NuxtLink
        v-for="action in actions"
        :key="action.to"
        class="speed-dial__item"
        :to="action.to"
      >
        {{ action.label }}
      </NuxtLink>
    </div>
    <button
      class="speed-dial__trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-label="Apri azioni calendario"
      @click="isOpen = !isOpen"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.speed-dial {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(var(--shell-bottom-nav-space) + max(18px, env(safe-area-inset-bottom)));
  z-index: 30;
  display: grid;
  justify-items: end;
  gap: 10px;
}

.speed-dial__actions {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.speed-dial__item,
.speed-dial__trigger {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
}

.speed-dial__item {
  min-height: 42px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #ffffff;
  color: var(--color-ink);
  text-decoration: none;
}

.speed-dial__trigger {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 999px;
  background: var(--color-ink);
  color: #ffffff;
  font-size: 2rem;
  line-height: 1;
}

.speed-dial--open .speed-dial__trigger {
  transform: rotate(45deg);
}
</style>
