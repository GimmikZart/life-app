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
  --shadow-soft: 0 18px 48px rgba(15, 23, 42, 0.12);
  --shell-inline-padding: 14px;
  --shell-bottom-nav-space: 104px;
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
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 28rem),
    var(--color-page);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.app-shell {
  min-height: 100vh;
}

a {
  color: inherit;
}

button,
input {
  font: inherit;
}

@media (min-width: 760px) {
  :root {
    --shell-inline-padding: 24px;
    --shell-bottom-nav-space: 0px;
  }
}

@media (min-width: 1040px) {
  :root {
    --shell-inline-padding: 40px;
  }
}
</style>
