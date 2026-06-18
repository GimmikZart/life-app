<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
body {
  margin: 0;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  color: #111827;
  background: #f8fafc;
}

.app-shell {
  min-height: 100vh;
}
</style>
