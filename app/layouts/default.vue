<template>
  <div class="default-layout">
    <AppHeader />
    <div class="default-layout__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.default-layout {
  min-height: 100vh;
}

.default-layout__content {
  min-height: calc(100vh - 72px);
}
</style>
