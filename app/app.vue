<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
:root {
  --color-ink: #111827;
  --color-muted: #4b5563;
  --color-line: #e5e7eb;
  --color-panel: #ffffff;
  --color-page: #f8fafc;
  --color-accent: #2563eb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  color: var(--color-ink);
  background: var(--color-page);
}

.app-shell {
  min-height: 100vh;
}

a {
  color: inherit;
}
</style>
