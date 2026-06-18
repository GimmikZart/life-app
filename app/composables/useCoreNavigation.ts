export type CoreNavigationItem = {
  label: string
  path: string
  description: string
}

export function useCoreNavigation() {
  return [
    {
      label: 'Today',
      path: '/',
      description: 'Home operativa della giornata'
    },
    {
      label: 'Calendario',
      path: '/calendar',
      description: 'Eventi, disponibilita e viste temporali'
    },
    {
      label: 'Obiettivi',
      path: '/objectives',
      description: 'Direzioni e progressi collegati alle Action'
    },
    {
      label: 'Skill',
      path: '/skills',
      description: 'Competenze, momentum e gamification'
    },
    {
      label: 'Proprieta',
      path: '/properties',
      description: 'Oggetti e aree della vita da gestire'
    }
  ] satisfies CoreNavigationItem[]
}
