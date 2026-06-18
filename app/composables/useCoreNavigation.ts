export type CoreNavigationItem = {
  label: string
  shortLabel: string
  path: string
  description: string
}

export function useCoreNavigation() {
  return [
    {
      label: 'Today',
      shortLabel: 'Today',
      path: '/',
      description: 'Home operativa della giornata'
    },
    {
      label: 'Calendario',
      shortLabel: 'Cal',
      path: '/calendar',
      description: 'Eventi, disponibilita e viste temporali'
    },
    {
      label: 'Obiettivi',
      shortLabel: 'Goal',
      path: '/objectives',
      description: 'Direzioni e progressi collegati alle Action'
    },
    {
      label: 'Skill',
      shortLabel: 'Skill',
      path: '/skills',
      description: 'Competenze, momentum e gamification'
    },
    {
      label: 'Proprieta',
      shortLabel: 'Asset',
      path: '/properties',
      description: 'Oggetti e aree della vita da gestire'
    }
  ] satisfies CoreNavigationItem[]
}
