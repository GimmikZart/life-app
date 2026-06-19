<template>
  <main class="calendar-page">
    <CalendarBoard event-scope="all" />
  </main>
</template>

<style scoped>
.calendar-page {
  width: min(100% - (var(--shell-inline-padding) * 2), 1120px);
  margin: 0 auto;
  padding: 12px 0 32px;
}

@media (min-width: 760px) {
  .calendar-page {
    padding: 22px 0 40px;
  }
}
</style>
