<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import multiMonthPlugin from '@fullcalendar/multimonth'
import listPlugin from '@fullcalendar/list'
import type { CalendarApi, CalendarOptions, DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core'
import itLocale from '@fullcalendar/core/locales/it'

type CalendarViewMode = 'year' | 'month' | 'week' | 'day' | 'events'

type CalendarOccurrence = {
  id: string
  eventId: string
  occurrenceDate: string
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
  source: string
  syncStatus: 'synced' | 'pending' | 'error'
  syncError: string | null
  association: { userId: string; name: string | null; color: string | null; icon: string | null } | null
  actionId: string | null
  completed: boolean
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
  { value: 'year', label: 'Anno', fullCalendarView: 'multiMonthYear' },
  { value: 'month', label: 'Mese', fullCalendarView: 'dayGridMonth' },
  { value: 'week', label: 'Sett.', fullCalendarView: 'timeGridWeek' },
  { value: 'day', label: 'Giorno', fullCalendarView: 'timeGridDay' },
  { value: 'events', label: 'Eventi', fullCalendarView: 'listMonth' }
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
const isFabOpen = ref(false)

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

// Calendari effettivamente visibili: sorgente di verità per la vista.
// Pilotata sia dalla select (focus rapido) sia dal pannello "Filtra" (multi-selezione).
const visibleCalendarIds = ref<string[]>([])
const isFilterOpen = ref(false)

// Inizializza sul primario e ripulisce gli id non più validi (es. calendario eliminato).
watch(layers, (nextLayers) => {
  const availableIds = nextLayers.map((layer) => layer.id)
  visibleCalendarIds.value = visibleCalendarIds.value.filter((id) => availableIds.includes(id))

  if (!visibleCalendarIds.value.length) {
    const primary = nextLayers.find((layer) => layer.myIsPrimary)
    const fallback = primary?.id ?? nextLayers[0]?.id
    visibleCalendarIds.value = fallback ? [fallback] : []
  }
}, { immediate: true })

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((id) => b.includes(id))
}

// Valore mostrato dalla select: 'official' se coincide con la vista ufficiale,
// l'id se è un solo calendario, altrimenti 'custom' (selezione multipla via Filtra).
const selectModel = computed<string>({
  get() {
    if (officialLayerIds.value.length > 1 && sameSet(visibleCalendarIds.value, officialLayerIds.value)) {
      return 'official'
    }

    return visibleCalendarIds.value.length === 1 ? (visibleCalendarIds.value[0] ?? '') : 'custom'
  },
  set(value) {
    if (value === 'official') {
      visibleCalendarIds.value = [...officialLayerIds.value]
    } else if (value !== 'custom') {
      visibleCalendarIds.value = [value]
    }
  }
})

function isLayerVisible(id: string) {
  return visibleCalendarIds.value.includes(id)
}

function toggleLayerVisible(id: string) {
  visibleCalendarIds.value = visibleCalendarIds.value.includes(id)
    ? visibleCalendarIds.value.filter((layerId) => layerId !== id)
    : [...visibleCalendarIds.value, id]
}

// Il pin (integrazione manuale) e PER-UTENTE: posso fissare nella mia vista
// ufficiale qualsiasi evento che vedo (anche di calendari condivisi/pubblici).
function canPinOccurrence(occurrence: CalendarOccurrence) {
  return layers.value.some((layer) => layer.id === occurrence.calendarId)
}

const primaryCalendarId = computed(() => layers.value.find((layer) => layer.myIsPrimary)?.id ?? '')

function canEditOccurrence(occurrence: CalendarOccurrence) {
  const layer = layers.value.find((item) => item.id === occurrence.calendarId)

  return layer?.myPermission === 'owner' || layer?.myPermission === 'editor'
}

function isOccurrenceInPrimary(occurrence: CalendarOccurrence) {
  return occurrence.calendarId === primaryCalendarId.value
}

// Apre la pagina completa dell'evento (modifica/eliminazione di tutti i campi).
// Passa l'occorrenza (chiave + orario mostrato) per gestire le eccezioni di ricorrenza.
function openSelectedEvent() {
  const occurrence = selectedOccurrence.value
  if (!occurrence) {
    return
  }

  const params = new URLSearchParams({
    eventId: occurrence.eventId,
    occurrence: occurrence.occurrenceDate,
    start: occurrence.startAt
  })
  navigateTo(`/calendar/create-event?${params.toString()}`)
}

// Sposta (cambia calendario) l'evento nel calendario principale dell'utente.
async function moveSelectedToPrimary() {
  if (!selectedOccurrence.value) {
    return
  }

  isPinning.value = true

  try {
    await $fetch(`/api/calendar-events/${selectedOccurrence.value.eventId}/move-to-primary`, { method: 'POST' })
    selectedOccurrence.value = null
    await loadEvents()
  } catch (error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }
    errorMessage.value = fetchError?.data?.statusMessage ?? 'Impossibile spostare l\'evento.'
  } finally {
    isPinning.value = false
  }
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

const isCompleting = ref(false)

function completionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const fetchError = error as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? error.message
  }

  return 'Operazione non riuscita.'
}

// Completa/annulla l'occorrenza di una Action, partendo dall'evento calendario
// selezionato (Sotto-Ciclo 3.4).
async function toggleCompletion(occurrence: CalendarOccurrence) {
  if (!occurrence.actionId || isCompleting.value) {
    return
  }

  isCompleting.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/action-completions' as string, {
      method: occurrence.completed ? 'DELETE' : 'POST',
      body: { calendarEventId: occurrence.eventId }
    })

    occurrence.completed = !occurrence.completed
    await loadEvents()
  } catch (error) {
    errorMessage.value = completionErrorMessage(error)
  } finally {
    isCompleting.value = false
  }
}

const calendarTitle = computed(() => {
  return capitalizeDate(displayRange.start.toLocaleDateString('it-IT', {
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
      classNames: occurrence.completed ? ['fc-event--done'] : [],
      extendedProps: { occurrence }
    }
  })
)

// Data/ora selezionata cliccando sul calendario (default: oggi). Pilota
// l'evidenziazione della cella, la lista eventi del giorno e il default di "Crea evento".
const selectedStart = ref<Date | null>(null)

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// Giorni del periodo caricato con almeno un evento → puntino nel calendario.
const daysWithEvents = computed(() => {
  const keys = new Set<string>()
  for (const occurrence of occurrences.value) {
    keys.add(dayKey(new Date(occurrence.startAt)))
  }

  return keys
})

// Giorno selezionato (oggi finché non si clicca) e relativa chiave.
const selectedDay = computed(() => selectedStart.value ?? new Date())
const selectedDayKey = computed(() => dayKey(selectedDay.value))

const calendarOptions = computed<CalendarOptions>(() => {
  const selectedKey = selectedDayKey.value
  const eventDays = daysWithEvents.value

  return {
    plugins: [dayGridPlugin, timeGridPlugin, multiMonthPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: false,
    height: 'auto',
    locale: itLocale,
    firstDay: 1,
    nowIndicator: true,
    allDaySlot: false,
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    expandRows: true,
    noEventsText: 'Nessun evento nel periodo',
    selectable: true,
    // In vista Mese niente blocchi-evento: solo un puntino sui giorni con eventi
    // (i dettagli del giorno selezionato compaiono nella lista sotto il calendario).
    views: { dayGridMonth: { eventDisplay: 'none' } },
    dayCellClassNames: (arg) => {
      const classes: string[] = []
      const key = dayKey(arg.date)

      if (eventDays.has(key)) {
        classes.push('cal-day--has-events')
      }
      if (key === selectedKey) {
        classes.push('cal-day--selected')
      }

      return classes
    },
    events: calendarEvents.value,
    datesSet: handleDatesSet,
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    select: handleSelect
  }
})

function goToToday() {
  getCalendarApi()?.today()
}

// Calendario "a fuoco" nella vista: se ne stai guardando uno solo è quello,
// altrimenti il primario. Diventa il default in fase di creazione evento.
const focusedCalendarId = computed(() => {
  if (visibleCalendarIds.value.length === 1) {
    return visibleCalendarIds.value[0]
  }

  return layers.value.find((layer) => layer.myIsPrimary)?.id ?? layers.value[0]?.id ?? ''
})

const createEventLink = computed(() => {
  const params = new URLSearchParams()
  if (selectedStart.value) {
    params.set('start', selectedStart.value.toISOString())
  }
  if (focusedCalendarId.value) {
    params.set('calendarId', focusedCalendarId.value)
  }
  const query = params.toString()

  return query ? `/calendar/create-event?${query}` : '/calendar/create-event'
})

function handleDateClick(arg: { date: Date; allDay: boolean; view: { type: string } }) {
  const date = new Date(arg.date)
  const isTimeGrid = arg.view.type === 'timeGridWeek' || arg.view.type === 'timeGridDay'

  // In vista mese il click è "all day" (mezzanotte): porto a un orario sensato.
  if (!isTimeGrid && arg.allDay && date.getHours() === 0 && date.getMinutes() === 0) {
    date.setHours(9, 0, 0, 0)
  }

  selectedStart.value = date

  // In Settimana/Giorno evidenzio lo slot cliccato (durata default 1h).
  if (isTimeGrid) {
    getCalendarApi()?.select(date, new Date(date.getTime() + 3_600_000))
  }
}

function handleSelect(arg: { start: Date }) {
  selectedStart.value = new Date(arg.start)
}

// Eventi del giorno selezionato (per la lista sotto il calendario in vista Mese).
const selectedDayOccurrences = computed(() =>
  occurrences.value
    .filter((occurrence) => dayKey(new Date(occurrence.startAt)) === selectedDayKey.value)
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
)

const selectedDayLabel = computed(() => {
  const day = selectedDay.value
  const today = new Date()
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const diff = Math.round((startOfDay - startOfToday) / 86_400_000)

  if (diff === 0) return 'Oggi'
  if (diff === 1) return 'Domani'
  if (diff === -1) return 'Ieri'

  return capitalizeDate(day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))
})

// Swipe orizzontale (mobile) per cambiare periodo. Su desktop restano le frecce.
let touchStartX = 0
let touchStartY = 0

function onTouchStart(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (touch) {
    touchStartX = touch.clientX
    touchStartY = touch.clientY
  }
}

function onTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (!touch) {
    return
  }

  const deltaX = touch.clientX - touchStartX
  const deltaY = touch.clientY - touchStartY

  // Solo se lo swipe è chiaramente orizzontale (per non confliggere con lo scroll).
  if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    moveCalendar(deltaX < 0 ? 'next' : 'prev')
  }
}

// Ricerca eventi per titolo.
type SearchResult = { id: string; title: string; startAt: string; calendarName: string }
const isSearchOpen = ref(false)
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(runSearch, 250)
}

async function runSearch() {
  const query = searchQuery.value.trim()

  if (query.length < 2) {
    searchResults.value = []

    return
  }

  isSearching.value = true

  try {
    const data = await $fetch<{ events: SearchResult[] }>('/api/calendar-events/search', { query: { q: query } })
    searchResults.value = data.events
  } catch {
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

function openSearchResult(result: SearchResult) {
  getCalendarApi()?.gotoDate(result.startAt)
  changeView('day')
  isSearchOpen.value = false
  searchQuery.value = ''
  searchResults.value = []
}

function formatSearchDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

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

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
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

function providerLabel(source: string) {
  if (source === 'google') return 'Google'
  if (source === 'microsoft') return 'Outlook'

  return 'Life App'
}

function syncStatusLabel(occurrence: CalendarOccurrence) {
  if (occurrence.source === 'life_app') {
    return ''
  }

  if (occurrence.syncStatus === 'pending') return 'Sync in attesa'
  if (occurrence.syncStatus === 'error') return 'Sync in errore'

  return 'Sincronizzato'
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
    <div class="cal-toolbar">
      <div class="cal-toolbar__row">
        <h3 class="cal-toolbar__title">{{ calendarTitle }}</h3>
        <div class="cal-toolbar__actions" aria-label="Azioni calendario">
          <button class="cal-icon" type="button" aria-label="Periodo precedente" @click="moveCalendar('prev')">‹</button>
          <button class="cal-icon" type="button" aria-label="Periodo successivo" @click="moveCalendar('next')">›</button>
          <button class="cal-icon" type="button" aria-label="Cerca eventi" @click="isSearchOpen = true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          </button>
          <button
            class="cal-icon"
            :class="{ 'cal-icon--active': isFilterOpen || visibleCalendarIds.length > 1 }"
            type="button"
            aria-label="Filtra calendari"
            @click="isFilterOpen = !isFilterOpen"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 4 21 4 14 12.5 14 19 10 21 10 12.5 3 4" /></svg>
          </button>
        </div>
      </div>

      <div class="cal-views" role="tablist" aria-label="Cambia vista calendario">
        <button
          v-for="mode in viewModes"
          :key="mode.value"
          class="cal-views__button"
          :class="{ 'cal-views__button--active': activeView === mode.value }"
          type="button"
          @click="changeView(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>

      <div v-if="layers.length" class="cal-picker">
        <select id="calendar-view-select" v-model="selectModel" class="cal-picker__select" aria-label="Calendario da mostrare">
          <option v-for="layer in layers" :key="layer.id" :value="layer.id">
            {{ layer.name }}{{ layer.myIsPrimary ? ' ★' : '' }}
          </option>
          <option v-if="officialLayerIds.length > 1" value="official">Vista ufficiale (tutti gli integrati)</option>
          <option v-if="selectModel === 'custom'" value="custom" disabled>Più calendari ({{ visibleCalendarIds.length }})</option>
        </select>
      </div>

      <div v-if="isFilterOpen && layers.length" class="cal-filter">
        <p class="cal-filter__title">Mostra calendari</p>
        <label v-for="layer in layers" :key="layer.id" class="cal-filter__row">
          <input type="checkbox" :checked="isLayerVisible(layer.id)" @change="toggleLayerVisible(layer.id)">
          <span class="cal-filter__dot" :style="{ backgroundColor: layer.color }" aria-hidden="true" />
          <span>{{ layer.name }}{{ layer.myIsPrimary ? ' ★' : '' }}</span>
        </label>
      </div>
    </div>

    <p v-if="errorMessage" class="calendar-board__notice" :class="{ 'calendar-board__notice--cache': loadedFromCache }">
      {{ errorMessage }}
    </p>
    <p v-else-if="isLoading" class="calendar-board__notice">
      Aggiorno gli eventi...
    </p>

    <div class="cal-surface" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <ClientOnly>
        <FullCalendar ref="calendarRef" :options="calendarOptions" />
        <template #fallback>
          <div class="calendar-board__fallback">Caricamento calendario...</div>
        </template>
      </ClientOnly>
    </div>

    <section v-if="activeView === 'month'" class="day-agenda" aria-label="Eventi del giorno selezionato">
      <p class="day-agenda__label">{{ selectedDayLabel }}</p>
      <p v-if="!selectedDayOccurrences.length" class="day-agenda__empty">Nessun evento</p>
      <button
        v-for="occurrence in selectedDayOccurrences"
        :key="occurrence.id"
        class="day-agenda__row"
        type="button"
        :style="{ '--row-color': occurrence.association?.color || occurrence.calendarColor }"
        @click="selectedOccurrence = occurrence"
      >
        <span class="day-agenda__stripe" aria-hidden="true" />
        <span class="day-agenda__time">{{ formatTime(occurrence.startAt) }}</span>
        <span class="day-agenda__title" :class="{ 'day-agenda__title--done': occurrence.completed }">
          <template v-if="occurrence.completed">✓ </template><template v-if="occurrence.association?.icon">{{ occurrence.association.icon }} </template>{{ occurrence.title }}
        </span>
      </button>
    </section>

    <div v-if="isSearchOpen" class="cal-search">
      <button class="cal-search__backdrop" type="button" aria-label="Chiudi ricerca" @click="isSearchOpen = false" />
      <div class="cal-search__panel" role="dialog" aria-label="Cerca eventi">
        <input
          v-model="searchQuery"
          class="cal-search__input"
          type="search"
          placeholder="Cerca un evento per titolo..."
          autofocus
          @input="onSearchInput"
        >
        <p v-if="isSearching" class="cal-search__hint">Cerco...</p>
        <p v-else-if="searchQuery.trim().length >= 2 && !searchResults.length" class="cal-search__hint">Nessun evento trovato.</p>
        <ul class="cal-search__results">
          <li v-for="result in searchResults" :key="result.id">
            <button class="cal-search__result" type="button" @click="openSearchResult(result)">
              <strong>{{ result.title }}</strong>
              <span>{{ formatSearchDate(result.startAt) }} · {{ result.calendarName }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

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
        <span v-if="selectedOccurrence.actionId" class="occurrence-detail__badge occurrence-detail__badge--action">Action</span>
        <span v-if="selectedOccurrence.completed" class="occurrence-detail__badge occurrence-detail__badge--done">✓ Completata</span>
        <span v-if="selectedOccurrence.pinnedToPrimary" class="occurrence-detail__badge occurrence-detail__badge--pin">Nel principale</span>
        <span v-if="selectedOccurrence.source !== 'life_app'" class="occurrence-detail__badge occurrence-detail__badge--sync">
          {{ providerLabel(selectedOccurrence.source) }} · {{ syncStatusLabel(selectedOccurrence) }}
        </span>
      </div>
      <p v-if="selectedOccurrence.syncStatus === 'error' && selectedOccurrence.syncError" class="occurrence-detail__sync-error">
        {{ selectedOccurrence.syncError }}
      </p>

      <div class="occurrence-detail__actions">
        <button
          v-if="selectedOccurrence.actionId"
          class="occurrence-detail__btn occurrence-detail__btn--primary"
          type="button"
          :disabled="isCompleting"
          @click="toggleCompletion(selectedOccurrence)"
        >
          {{ selectedOccurrence.completed ? 'Annulla completamento' : '✓ Completa Action' }}
        </button>

        <button class="occurrence-detail__btn occurrence-detail__btn--primary" type="button" @click="openSelectedEvent">
          Apri / Modifica
        </button>

        <template v-if="!isOccurrenceInPrimary(selectedOccurrence)">
          <button
            v-if="canEditOccurrence(selectedOccurrence)"
            class="occurrence-detail__btn"
            type="button"
            :disabled="isPinning"
            @click="moveSelectedToPrimary"
          >
            Sposta nel principale
          </button>
          <button
            v-else-if="canPinOccurrence(selectedOccurrence)"
            class="occurrence-detail__btn"
            type="button"
            :disabled="isPinning"
            @click="togglePin(selectedOccurrence)"
          >
            {{ selectedOccurrence.pinnedToPrimary ? 'Togli dal principale' : 'Aggiungi al principale' }}
          </button>
        </template>
      </div>
    </aside>

    <div class="cal-fab" :class="{ 'cal-fab--open': isFabOpen }">
      <div v-if="isFabOpen" class="cal-fab__menu">
        <NuxtLink class="cal-fab__item" :to="createEventLink" @click="isFabOpen = false">
          Crea evento<template v-if="selectedStart"> ({{ selectedStart.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) }})</template>
        </NuxtLink>
        <button class="cal-fab__item" type="button" @click="goToToday(); isFabOpen = false">Vai a oggi</button>
      </div>
      <button
        class="cal-fab__trigger"
        type="button"
        :aria-expanded="isFabOpen"
        aria-label="Azioni calendario"
        @click="isFabOpen = !isFabOpen"
      >+</button>
    </div>
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

.cal-toolbar {
  position: sticky;
  top: 60px;
  z-index: 12;
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-line);
}

.cal-toolbar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cal-toolbar__title {
  margin: 0;
}

.cal-toolbar__nav {
  display: flex;
  gap: 6px;
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

.cal-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cal-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: #ffffff;
  color: var(--color-ink);
  cursor: pointer;
  font-size: 1.3rem;
  line-height: 1;
}

.cal-icon--active {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: #ffffff;
}

.cal-filter {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: #f8fafc;
}

.cal-filter__title {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cal-filter__row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  cursor: pointer;
}

.cal-filter__row input {
  width: 18px;
  height: 18px;
}

.cal-filter__dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.cal-search {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  padding: 14vh 16px 16px;
}

.cal-search__backdrop {
  position: fixed;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.45);
}

.cal-search__panel {
  position: relative;
  z-index: 1;
  width: min(560px, 100%);
  max-height: 70vh;
  overflow-y: auto;
  padding: 14px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.3);
}

.cal-search__input {
  width: 100%;
  min-height: 50px;
  padding: 0 14px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  font: inherit;
}

.cal-search__hint {
  margin: 12px 4px 0;
  color: var(--color-muted);
}

.cal-search__results {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.cal-search__result {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: #f8fafc;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.cal-search__result span {
  color: var(--color-muted);
  font-size: 0.84rem;
}

.cal-views {
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow-x: auto;
}

.cal-views__button {
  flex: 1 1 auto;
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  white-space: nowrap;
}

.cal-views__button--active {
  background: var(--color-ink);
  color: #ffffff;
}

.cal-picker__select {
  min-height: 44px;
  width: 100%;
  padding: 0 13px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
  font-weight: 800;
}

.cal-fab {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(var(--shell-bottom-nav-space) + max(18px, env(safe-area-inset-bottom)));
  z-index: 30;
  display: grid;
  justify-items: end;
  gap: 10px;
}

.cal-fab__menu {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.cal-fab__item {
  min-height: 42px;
  padding: 10px 16px;
  border: 0;
  border-radius: 999px;
  background: #ffffff;
  color: var(--color-ink);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  text-decoration: none;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
}

.cal-fab__trigger {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: var(--color-ink);
  color: #ffffff;
  cursor: pointer;
  font-size: 2rem;
  line-height: 1;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.22);
}

.cal-fab--open .cal-fab__trigger {
  transform: rotate(45deg);
}

@media (min-width: 760px) {
  .cal-views__button {
    flex: 0 0 auto;
  }

  .cal-picker__select {
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

.occurrence-detail__badge--sync {
  background: #eef2ff;
  color: #3730a3;
}

.occurrence-detail__sync-error {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fee2e2;
  color: #991b1b;
  font-weight: 800;
}

.occurrence-detail__actions {
  display: grid;
  gap: 8px;
}

.occurrence-detail__btn {
  min-height: 44px;
  width: 100%;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  cursor: pointer;
  font: inherit;
  font-weight: 900;
}

.occurrence-detail__btn--primary {
  border: 0;
  background: var(--color-ink);
  color: #ffffff;
}

.occurrence-detail__btn:disabled {
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

.occurrence-detail__badge--action {
  background: var(--color-accent);
  color: #ffffff;
}

.occurrence-detail__badge--done {
  background: #dcfce7;
  color: #166534;
}

.day-agenda__title--done {
  color: var(--color-muted);
  text-decoration: line-through;
}

/* Evento completato in vista calendario: visivamente smorzato. */
:deep(.fc-event--done) {
  opacity: 0.55;
}

:deep(.fc-event--done .fc-event-title),
:deep(.fc-event--done .fc-list-event-title) {
  text-decoration: line-through;
}

/* Vista Mese: numeri centrati, giorno selezionato cerchiato, puntino sui giorni con eventi. */
:deep(.fc-daygrid-day-top) {
  flex-direction: row;
  justify-content: center;
}

:deep(.fc-daygrid-day-number) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-top: 4px;
  border-radius: 999px;
}

:deep(.cal-day--selected .fc-daygrid-day-number) {
  border: 1.5px solid var(--color-accent);
  color: var(--color-accent);
  font-weight: 900;
}

:deep(.cal-day--has-events .fc-daygrid-day-number)::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--color-muted);
  transform: translateX(-50%);
}

.day-agenda {
  margin-top: 14px;
}

.day-agenda__label {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 900;
  text-transform: capitalize;
}

.day-agenda__empty {
  margin: 0;
  padding: 16px 0;
  color: var(--color-muted);
  text-align: center;
}

.day-agenda__row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  border: 0;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.day-agenda__stripe {
  flex: 0 0 auto;
  width: 4px;
  align-self: stretch;
  min-height: 32px;
  border-radius: 999px;
  background: var(--row-color, var(--color-accent));
}

.day-agenda__time {
  flex: 0 0 auto;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.day-agenda__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Evidenziazione dello slot orario selezionato (Settimana/Giorno). */
:deep(.fc-highlight) {
  background: rgba(37, 99, 235, 0.18);
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
