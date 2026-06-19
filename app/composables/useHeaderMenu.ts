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
    const path = route.path

    if (path.startsWith('/calendar/relations')) {
      return [
        { label: 'Aggiungi relazione', to: '/calendar/relations/invite' },
        { label: 'Vai al calendario', to: '/calendar' }
      ]
    }

    if (path.startsWith('/calendar')) {
      return [
        { label: 'Confronta disponibilità', to: '/calendar/availability' },
        { label: 'Le mie room', to: '/calendar/rooms' },
        { label: 'Crea evento', to: '/calendar/create-event' },
        { label: 'Crea calendario', to: '/calendar/create' },
        { label: 'I miei calendari', to: '/calendar/manage' },
        { label: 'Relazioni', to: '/calendar/relations' }
      ]
    }

    return []
  })

  return { showLogout, items }
}
