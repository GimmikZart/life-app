<script setup lang="ts">
const route = useRoute()
const navigationItems = useCoreNavigation()
const { user } = useUser()

const displayName = computed(() => {
  const metadataName = user.value?.user_metadata?.name

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName
  }

  return user.value?.email ?? 'Account'
})
</script>

<template>
  <header class="app-header">
    <NuxtLink class="app-header__brand" to="/" aria-label="Life App home">
      <span class="app-header__brand-mark">LA</span>
      <span class="app-header__brand-text">Life App</span>
    </NuxtLink>

    <nav class="app-header__nav" aria-label="Navigazione principale">
      <NuxtLink
        v-for="item in navigationItems"
        :key="item.path"
        class="app-header__nav-link"
        :class="{ 'app-header__nav-link--active': route.path === item.path }"
        :to="item.path"
      >
        {{ item.label }}
      </NuxtLink>
    </nav>

    <div class="app-header__user">
      <span class="app-header__user-name">{{ displayName }}</span>
      <NuxtLink class="app-header__logout" to="/logout">Logout</NuxtLink>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: max(10px, env(safe-area-inset-top)) var(--shell-inline-padding) 10px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(248, 250, 252, 0.78));
  backdrop-filter: blur(16px);
}

.app-header__brand,
.app-header__nav-link,
.app-header__logout {
  text-decoration: none;
}

.app-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-weight: 800;
}

.app-header__brand-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 8px;
  background: var(--color-ink);
  color: #ffffff;
  font-size: 0.78rem;
}

.app-header__brand-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__nav {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow-x: auto;
}

.app-header__nav-link {
  padding: 9px 12px;
  border-radius: 6px;
  color: var(--color-muted);
  font-size: 0.92rem;
  font-weight: 700;
  white-space: nowrap;
}

.app-header__nav-link--active {
  background: #e0ecff;
  color: #174ea6;
}

.app-header__user {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
}

.app-header__user-name {
  max-width: 38vw;
  overflow: hidden;
  color: var(--color-muted);
  font-size: 0.9rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__logout {
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  font-weight: 800;
}

@media (max-width: 420px) {
  .app-header__brand-text,
  .app-header__user-name {
    display: none;
  }
}

@media (min-width: 760px) {
  .app-header {
    grid-template-columns: auto 1fr auto;
    gap: 20px;
    min-height: 74px;
    padding: 0 var(--shell-inline-padding);
    border-bottom: 1px solid rgba(229, 231, 235, 0.86);
  }

  .app-header__nav {
    display: flex;
  }

  .app-header__user-name {
    max-width: 180px;
  }
}
</style>
