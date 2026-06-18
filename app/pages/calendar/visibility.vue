<template>
  <main class="calendar-tool">
    <div class="calendar-tool__header">
      <NuxtLink class="back-link" to="/calendar">Torna al calendario</NuxtLink>
      <p class="calendar-tool__eyebrow">Privacy</p>
      <h1>Relazioni e visibilita</h1>
    </div>

    <CalendarVisibilityPanel />
  </main>
</template>

<style scoped>
.calendar-tool {
  width: min(100% - (var(--shell-inline-padding) * 2), 1120px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.calendar-tool__header {
  margin-bottom: 18px;
}

.calendar-tool__eyebrow {
  margin: 16px 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: 2.2rem;
  line-height: 1.05;
  letter-spacing: 0;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

@media (min-width: 760px) {
  .calendar-tool {
    padding: 34px 0 44px;
  }
}
</style>
