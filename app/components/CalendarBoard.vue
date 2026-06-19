<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { CalendarApi, CalendarOptions, DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core'
import itLocale from '@fullcalendar/core/locales/it'

type CalendarViewMode = 'month' | 'week' | 'day'

type CalendarOccurrence = {
  id: string
  eventId: string
  calendarId: string
  calendarName: string
  calendarColor: string
  title: string
  category: string | null
  startAt: string
  endAt: string
  isRecurring: boolean
  visibilityDefault: 'clear' | 'busy' | 'hidden'
  pinnedToPrimary: boolean
  association: { userId: string; name: string | null; color: string | null; icon: string | null } | null
}

type CalendarEventsResponse = {
  events: unknown[]
  occurrences: CalendarOccurrence[]
}

type CalendarLayer = {
  id: string
  name: string
  color: string
  myPermission: 'owner' | 'editor' | 'viewer'
  myStatus: 'pending' | 'accepted' | 'declined'
  myIsPrimary: boolean
  myAutoIntegrate: boolean
}

type CalendarsResponse = {
  calendars: CalendarLayer[]
}

const props = withDefaults(defineProps<{
  eventScope?: 'mine' | 'all'
}>(), {
  eventScope: 'mine'
})

const viewModes: { value: CalendarViewMode; label: string; fullCalendarView: string }[] = [
  { value: 'month', label: 'Mese', fullCalendarView: 'dayGridMonth' },
  { value: 'week', label: 'Settimana', fullCalendarView: 'timeGridWeek' },
  { value: 'day', label: 'Giorno', fullCalendarView: 'timeGridDay' }
]

const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)
const activeView = ref<CalendarViewMode>('month')
const visibleRange = reactive({
  from: startOfMonth(new Date()).toISOString(),
  to: endOfMonth(new Date()).toISOString()
})
const displayRange = reactive({
  start: startOfMonth(new Date()),
  end: endOfMonth(new Date())
})
const occurrences = ref<CalendarOccurrence[]>([])
const selectedOccurrence = ref<CalendarOccurrence | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const loadedFromCache = ref(false)
const isPinning = ref(false)

// Layer del calendario: ogni calendario accessibile e un livello accendibile/spegnibile.
const { data: calendarsData } = await useFetch<CalendarsResponse>('/api/calendars', {
  default: () => ({ calendars: [] })
})

const layers = computed<CalendarLayer[]>(() =>
  (calendarsData.value?.calendars ?? []).filter((layer) => layer.myStatus === 'accepted')
)
const officialLayerIds = computed(() =>
  layers.value.filter((layer) => layer.myIsPrimary || layer.myAutoIntegrate).map((layer) => layer.id)
)

// Selettore della vista: 'official' (vista ufficiale) | id di un calendario singolo.
// Di default mostra il calendario primario ("Personale").
const selectedView = ref<'official' | string>('')

// Imposta il default sul primario e ripristina se la scelta non e piu valida
// (es. calendario eliminato).
watch(layers, (nextLayers) => {
  const stillValid = selectedView.value === 'official'
    || nextLayers.some((layer) => layer.id === selectedView.value)

  if (!stillValid) {
    const primary = nextLayers.find((layer) => layer.myIsPrimary)
    selectedView.value = primary?.id ?? nextLayers[0]?.id ?? ''
  }
}, { immediate: true })

// Calendari effettivamente visibili in base alla scelta della select.
const visibleCalendarIds = computed<string[]>(() => {
  if (selectedView.value === 'official') {
    return officialLayerIds.value
  }

  return layers.value.some((layer) => layer.id === selectedView.value)
    ? [selectedView.value]
    : []
})

// Il pin (integrazione manuale) e PER-UTENTE: posso fissare nella mia vista
// ufficiale qualsiasi evento che vedo (anche di calendari condivisi/pubblici).
function canPinOccurrence(occurrence: CalendarOccurrence) {
  return layers.value.some((layer) => layer.id === occurrence.calendarId)
}

// Ricarica gli eventi quando cambiano i layer visibili (solo dopo il primo render).
watch(visibleCalendarIds, () => {
  if (getCalendarApi()) {
    loadEvents()
  }
})

async function togglePin(occurrence: CalendarOccurrence) {
  isPinning.value = true

  try {
    await $fetch(`/api/calendar-events/${occurrence.eventId}/pin`, {
      method: 'PATCH',
      body: { pinnedToPrimary: !occurrence.pinnedToPrimary }
    })

    occurrence.pinnedToPrimary = !occurrence.pinnedToPrimary
    await loadEvents()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossibile aggiornare l\'evento.'
  } finally {
    isPinning.value = false
  }
}

const calendarTitle = computed(() => {
  if (activeView.value === 'month') {
    return capitalizeDate(displayRange.start.toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric'
    }))
  }

  if (activeView.value === 'week') {
    const weekEnd = addDays(displayRange.start, 6)

    if (displayRange.start.getMonth() === weekEnd.getMonth()
      && displayRange.start.getFullYear() === weekEnd.getFullYear()) {
      return capitalizeDate(`${displayRange.start.getDate()} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric'
      })}`)
    }

    return capitalizeDate(`${displayRange.start.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long'
    })} - ${weekEnd.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`)
  }

  return capitalizeDate(displayRange.start.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }))
})

const calendarEvents = computed<EventInput[]>(() =>
  occurrences.value.map((occurrence) => {
    const color = occurrence.association?.color || occurrence.calendarColor
    const baseTitle = occurrence.visibilityDefault === 'busy' ? 'Occupato' : occurrence.title
    const icon = occurrence.visibilityDefault === 'busy' ? '' : occurrence.association?.icon

    return {
      id: occurrence.id,
      title: icon ? `${icon} ${baseTitle}` : baseTitle,
      start: occurrence.startAt,
      end: occurrence.endAt,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      extendedProps: { occurrence }
    }
  })
)

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: false,
  height: 'auto',
  locale: itLocale,
  firstDay: 1,
  nowIndicator: true,
  allDaySlot: false,
  slotMinTime: '06:00:00',
  slotMaxTime: '23:00:00',
  expandRows: true,
  events: calendarEvents.value,
  datesSet: handleDatesSet,
  eventClick: handleEventClick
}))

async function handleDatesSet(arg: DatesSetArg) {
  visibleRange.from = arg.start.toISOString()
  visibleRange.to = arg.end.toISOString()
  displayRange.start = new Date(arg.view.currentStart)
  displayRange.end = new Date(arg.view.currentEnd)
  activeView.value = viewModes.find((viewMode) => viewMode.fullCalendarView === arg.view.type)?.value ?? activeView.value
  await loadEvents()
}

function handleEventClick(arg: EventClickArg) {
  selectedOccurrence.value = arg.event.extendedProps.occurrence as CalendarOccurrence
}

async function changeView(mode: CalendarViewMode) {
  activeView.value = mode
  getCalendarApi()?.changeView(viewModes.find((viewMode) => viewMode.value === mode)?.fullCalendarView ?? 'timeGridWeek')
}

async function moveCalendar(direction: 'prev' | 'today' | 'next') {
  const api = getCalendarApi()

  if (!api) {
    return
  }

  api[direction]()
}

async function loadEvents() {
  // Nessun layer acceso (ma esistono calendari): non mostrare nulla.
  if (layers.value.length && !visibleCalendarIds.value.length) {
    occurrences.value = []
    errorMessage.value = ''

    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await $fetch<CalendarEventsResponse>('/api/calendar-events', {
      query: {
        from: visibleRange.from,
        to: visibleRange.to,
        scope: props.eventScope,
        // Filtra per i layer accesi; se nessuno e selezionato non chiede eventi.
        calendarIds: visibleCalendarIds.value.join(',')
      }
    })

    occurrences.value = data.occurrences
    loadedFromCache.value = false
    writeCalendarCache(data.occurrences)
  } catch (error) {
    const cachedOccurrences = readCalendarCache()

    if (cachedOccurrences) {
      occurrences.value = cachedOccurrences
      loadedFromCache.value = true
      errorMessage.value = 'Sei offline: mostro gli ultimi eventi salvati su questo dispositivo.'
    } else {
      errorMessage.value = error instanceof Error ? error.message : 'Impossibile caricare il calendario.'
    }
  } finally {
    isLoading.value = false
  }
}

function getCalendarApi(): CalendarApi | null {
  return calendarRef.value?.getApi() ?? null
}

function writeCalendarCache(items: CalendarOccurrence[]) {
  if (!import.meta.client) {
    return
  }

  localStorage.setItem('life-app:calendar-board:latest', JSON.stringify({
    cachedAt: new Date().toISOString(),
    occurrences: items
  }))
}

function readCalendarCache() {
  if (!import.meta.client) {
    return null
  }

  const cached = localStorage.getItem('life-app:calendar-board:latest')

  if (!cached) {
    return null
  }

  try {
    const parsed = JSON.parse(cached) as { occurrences?: CalendarOccurrence[] }

    return Array.isArray(parsed.occurrences) ? parsed.occurrences : null
  } catch {
    return null
  }
}

function formatOccurrenceMeta(occurrence: CalendarOccurrence) {
  const start = new Date(occurrence.startAt)
  const end = new Date(occurrence.endAt)

  return `${start.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  })} - ${start.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })}-${end.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

function startOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)

  return nextDate
}

function capitalizeDate(value: string) {
  return value.charAt(0).toLocaleUpperCase('it-IT') + value.slice(1)
}
</script>

<template>
  <section class="calendar-board" aria-label="Calendario">
    <div class="calendar-board__topbar">
      <div>
        <h2>{{ calendarTitle }}</h2>
      </div>

      <div class="calendar-board__navigation" aria-label="Navigazione calendario">
        <button class="icon-button" type="button" @click="moveCalendar('prev')">
          Indietro
        </button>
        <button class="icon-button icon-button--strong" type="button" @click="moveCalendar('today')">
          Oggi
        </button>
        <button class="icon-button" type="button" @click="moveCalendar('next')">
          Avanti
        </button>
      </div>
    </div>

    <div class="view-switcher" role="tablist" aria-label="Cambia vista calendario">
      <button
        v-for="mode in viewModes"
        :key="mode.value"
        class="view-switcher__button"
        :class="{ 'view-switcher__button--active': activeView === mode.value }"
        type="button"
        @click="changeView(mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>

    <div v-if="layers.length" class="calendar-picker">
      <label class="calendar-picker__label" for="calendar-view-select">Calendario</label>
      <select id="calendar-view-select" v-model="selectedView" class="calendar-picker__select">
        <option v-for="layer in layers" :key="layer.id" :value="layer.id">
          {{ layer.name }}{{ layer.myIsPrimary ? ' ★' : '' }}
        </option>
        <option v-if="officialLayerIds.length > 1" value="official">Vista ufficiale (tutti gli integrati)</option>
      </select>
    </div>

    <p v-if="errorMessage" class="calendar-board__notice" :class="{ 'calendar-board__notice--cache': loadedFromCache }">
      {{ errorMessage }}
    </p>
    <p v-else-if="isLoading" class="calendar-board__notice">
      Aggiorno gli eventi...
    </p>

    <ClientOnly>
      <FullCalendar ref="calendarRef" :options="calendarOptions" />
      <template #fallback>
        <div class="calendar-board__fallback">Caricamento calendario...</div>
      </template>
    </ClientOnly>

    <aside v-if="selectedOccurrence" class="occurrence-detail">
      <button class="occurrence-detail__close" type="button" @click="selectedOccurrence = null">
        Chiudi
      </button>
      <p class="calendar-board__eyebrow">Dettaglio</p>
      <h3>{{ selectedOccurrence.title }}</h3>
      <p>{{ formatOccurrenceMeta(selectedOccurrence) }}</p>
      <p>{{ selectedOccurrence.calendarName }}<template v-if="selectedOccurrence.category"> - {{ selectedOccurrence.category }}</template></p>
      <p v-if="selectedOccurrence.association?.name" class="occurrence-detail__with">
        <span v-if="selectedOccurrence.association.icon" aria-hidden="true">{{ selectedOccurrence.association.icon }}</span>
        con {{ selectedOccurrence.association.name }}
      </p>
      <div class="occurrence-detail__tags">
        <span v-if="selectedOccurrence.isRecurring" class="occurrence-detail__badge">Ricorrente</span>
        <span v-if="selectedOccurrence.pinnedToPrimary" class="occurrence-detail__badge occurrence-detail__badge--pin">Nell'ufficiale</span>
      </div>
      <button
        v-if="canPinOccurrence(selectedOccurrence)"
        class="occurrence-detail__pin"
        type="button"
        :disabled="isPinning"
        @click="togglePin(selectedOccurrence)"
      >
        {{ selectedOccurrence.pinnedToPrimary ? 'Rimuovi dall\'ufficiale' : 'Fissa nell\'ufficiale' }}
      </button>
    </aside>
  </section>
</template>

<style scoped>
.calendar-board {
  padding: 16px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
}

.calendar-board__topbar,
.calendar-board__navigation,
.view-switcher {
  display: grid;
  gap: 10px;
}

.calendar-board__topbar {
  margin-bottom: 14px;
}

.calendar-board__eyebrow {
  margin: 0 0 7px;
  color: var(--color-accent);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin-top: 0;
}

h2 {
  margin-bottom: 0;
  font-size: 1.8rem;
  line-height: 1.08;
  letter-spacing: 0;
}

.calendar-board__navigation {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.icon-button,
.view-switcher__button {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.icon-button {
  background: #f1f5f9;
  color: var(--color-ink);
}

.icon-button--strong,
.view-switcher__button--active {
  background: var(--color-ink);
  color: #ffffff;
}

.view-switcher {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 5px;
  border-radius: 10px;
  background: #f1f5f9;
}

.view-switcher__button {
  background: transparent;
  color: var(--color-muted);
}

.view-switcher__button--active {
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.18);
}

.calendar-picker {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.calendar-picker__label {
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.calendar-picker__select {
  min-height: 48px;
  width: 100%;
  padding: 0 13px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
  font-weight: 800;
}

@media (min-width: 760px) {
  .calendar-picker {
    justify-items: start;
  }

  .calendar-picker__select {
    width: min(360px, 100%);
  }
}

.occurrence-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.occurrence-detail__badge--pin {
  background: #dcfce7;
  color: #166534;
}

.occurrence-detail__pin {
  min-height: 44px;
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: var(--color-ink);
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.occurrence-detail__pin:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.calendar-board__notice,
.calendar-board__fallback {
  margin: 12px 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #e0ecff;
  color: #174ea6;
  font-weight: 800;
}

.calendar-board__notice--cache {
  background: #fef3c7;
  color: #92400e;
}

.occurrence-detail {
  position: sticky;
  bottom: calc(var(--shell-bottom-nav-space) + 12px);
  z-index: 10;
  margin-top: 14px;
  padding: 16px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

.occurrence-detail p {
  color: var(--color-muted);
  line-height: 1.55;
}

.occurrence-detail__close {
  float: right;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: #ffffff;
  font-weight: 900;
}

.occurrence-detail__badge {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 8px;
  background: #e0ecff;
  color: #174ea6;
  font-size: 0.76rem;
  font-weight: 900;
}

:deep(.fc) {
  color: var(--color-ink);
  font-family: inherit;
}

:deep(.fc-theme-standard td),
:deep(.fc-theme-standard th),
:deep(.fc-theme-standard .fc-scrollgrid) {
  border-color: #e5e7eb;
}

:deep(.fc-col-header-cell-cushion),
:deep(.fc-daygrid-day-number) {
  color: var(--color-muted);
  text-decoration: none;
}

:deep(.fc-event) {
  border-radius: 6px;
  border-width: 0;
  padding: 2px 4px;
  font-weight: 800;
}

:deep(.fc-timegrid-slot) {
  height: 42px;
}

@media (max-width: 759px) {
  .calendar-board {
    margin-inline: calc(var(--shell-inline-padding) * -1);
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }

  :deep(.fc) {
    font-size: 0.78rem;
  }

  :deep(.fc-timegrid-axis) {
    width: 38px;
  }
}

@media (min-width: 760px) {
  .calendar-board {
    padding: 24px;
  }

  h2 {
    font-size: 2.35rem;
  }

  .calendar-board__topbar {
    grid-template-columns: 1fr auto;
    align-items: end;
  }

  .calendar-board__navigation {
    width: 320px;
  }

  .view-switcher {
    max-width: 420px;
  }
}
</style>
