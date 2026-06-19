export type FreeSlot = { start: string; end: string }
export type DayGroup<T> = { key: string; label: string; items: T[] }

// Algoritmo (sweep-line) per gli slot liberi comuni + raggruppamento per giorno.
// Tutto lato client: conosce il fuso locale, quindi le fasce orarie sono corrette.
export function useFreeSlots() {
  function addDays(date: Date, days: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)

    return next
  }

  // busy = intervalli occupati [startMs, endMs]; calcola i buchi liberi giorno per
  // giorno dentro la fascia [startHHMM, endHHMM], tenendo solo quelli >= minMinutes.
  function computeFreeSlots(
    busy: [number, number][],
    from: Date,
    to: Date,
    startHHMM: string,
    endHHMM: string,
    minMinutes: number
  ): FreeSlot[] {
    const [startHour, startMin] = startHHMM.split(':').map(Number)
    const [endHour, endMin] = endHHMM.split(':').map(Number)
    const minMs = Math.max(15, minMinutes) * 60_000
    const slots: FreeSlot[] = []

    let day = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    const lastDay = new Date(to.getFullYear(), to.getMonth(), to.getDate())

    while (day <= lastDay) {
      const windowStart = new Date(day)
      windowStart.setHours(startHour ?? 0, startMin ?? 0, 0, 0)
      const windowEnd = new Date(day)
      windowEnd.setHours(endHour ?? 0, endMin ?? 0, 0, 0)

      const ws = windowStart.getTime()
      const we = windowEnd.getTime()

      if (we > ws) {
        const dayBusy = busy
          .filter(([bs, be]) => be > ws && bs < we)
          .map(([bs, be]) => [Math.max(bs, ws), Math.min(be, we)] as [number, number])
          .sort((a, b) => a[0] - b[0])

        const merged: [number, number][] = []
        for (const interval of dayBusy) {
          const last = merged[merged.length - 1]
          if (last && interval[0] <= last[1]) {
            last[1] = Math.max(last[1], interval[1])
          } else {
            merged.push([...interval])
          }
        }

        let cursor = ws
        for (const [bs, be] of merged) {
          if (bs - cursor >= minMs) {
            slots.push({ start: new Date(cursor).toISOString(), end: new Date(bs).toISOString() })
          }
          cursor = Math.max(cursor, be)
        }
        if (we - cursor >= minMs) {
          slots.push({ start: new Date(cursor).toISOString(), end: new Date(we).toISOString() })
        }
      }

      day = addDays(day, 1)
    }

    return slots
  }

  function groupByDay<T>(items: T[], getStart: (item: T) => string): DayGroup<T>[] {
    const groups = new Map<string, T[]>()
    for (const item of items) {
      const date = new Date(getStart(item))
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      const bucket = groups.get(key) ?? []
      bucket.push(item)
      groups.set(key, bucket)
    }

    return [...groups.entries()].map(([key, value]) => ({
      key,
      label: new Date(getStart(value[0] as T)).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }),
      items: value
    }))
  }

  return { computeFreeSlots, groupByDay }
}
