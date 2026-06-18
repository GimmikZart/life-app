<template>
  <div class="default-layout">
    <AppHeader />
    <div class="default-layout__content">
      <slot />
    </div>
    <AppBottomNavigation />
  </div>
</template>

<style scoped>
.default-layout {
  min-height: 100vh;
}

.default-layout__content {
  min-height: calc(100svh - 64px);
  padding-bottom: var(--shell-bottom-nav-space);
}

@media (min-width: 760px) {
  .default-layout__content {
    min-height: calc(100vh - 74px);
  }
}
</style>
