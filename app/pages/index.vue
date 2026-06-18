<template>
  <main class="today-view">
    <header class="today-view__header">
      <p class="today-view__eyebrow">Life App</p>
      <h1>Today View</h1>
      <p>
        Punto di partenza della V1: calendario, eventi di oggi, action pianificate
        e disponibilita condivise.
      </p>
    </header>

    <section class="today-view__grid" aria-label="Today View wireframe">
      <article class="panel timeline-panel">
        <h2>Timeline giornata</h2>
        <div class="timeline-row">
          <span>09:00</span>
          <strong>Evento calendario</strong>
        </div>
        <div class="timeline-row">
          <span>13:00</span>
          <strong>Finestra libera</strong>
        </div>
        <div class="timeline-row">
          <span>18:30</span>
          <strong>Action pianificata</strong>
        </div>
      </article>

      <article class="panel">
        <h2>Action di oggi</h2>
        <ul>
          <li>Allenamento leggero</li>
          <li>Revisione agenda settimanale</li>
          <li>Preparare evento condiviso</li>
        </ul>
      </article>

      <article class="panel">
        <h2>Disponibilita condivise</h2>
        <ul>
          <li>Slot comune: 13:00 - 14:30</li>
          <li>Slot comune: 20:00 - 22:00</li>
        </ul>
      </article>

      <article class="panel">
        <h2>Prossimi eventi</h2>
        <ul>
          <li>Domani: manutenzione auto</li>
          <li>Venerdi: cena condivisa</li>
        </ul>
      </article>
    </section>
  </main>
</template>

<style scoped>
.today-view {
  width: min(100% - (var(--shell-inline-padding) * 2), 1120px);
  margin: 0 auto;
  padding: 18px 0 28px;
}

.today-view__header {
  max-width: 720px;
  margin-bottom: 20px;
}

.today-view__eyebrow {
  margin: 0 0 8px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #2563eb;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 10px;
  font-size: clamp(2.35rem, 14vw, 4.5rem);
  line-height: 0.9;
  letter-spacing: -0.06em;
}

h2 {
  margin-bottom: 16px;
  font-size: 1rem;
}

p,
li {
  color: #4b5563;
  line-height: 1.6;
}

.today-view__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.panel {
  min-height: 150px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
}

.timeline-row {
  display: grid;
  grid-template-columns: 62px 1fr;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid #e5e7eb;
}

.timeline-row span {
  color: #6b7280;
}

ul {
  margin: 0;
  padding-left: 18px;
}

@media (min-width: 760px) {
  .today-view {
    padding: 40px 0;
  }

  .today-view__header {
    margin-bottom: 32px;
  }

  h1 {
    font-size: clamp(3.3rem, 8vw, 5.4rem);
  }

  .today-view__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}

@media (min-width: 1040px) {
  .today-view__grid {
    grid-template-columns: 1.5fr 1fr;
  }

  .timeline-panel {
    grid-row: span 2;
  }
}
</style>
