export type HeaderMenuItem = {
  label: string
  to: string
}

// Definisce le azioni dell'header in modo dinamico per vista.
// La vista Today mostra il logout; le altre viste mostrano un menu di azioni utili.
export function useHeaderMenu() {
  const route = useRoute()

  const showLogout = computed(() => route.path === '/')

  const items = computed<HeaderMenuItem[]>(() => {
    if (route.path.startsWith('/calendar')) {
      // Menu unico e pulito per tutte le viste calendario.
      // "Confronta disponibilità" contiene le room; "I miei calendari" la creazione.
      return [
        { label: 'Confronta disponibilità', to: '/calendar/availability' },
        { label: 'I miei calendari', to: '/calendar/manage' },
        { label: 'Relazioni', to: '/calendar/relations' }
      ]
    }

    return []
  })

  return { showLogout, items }
}
