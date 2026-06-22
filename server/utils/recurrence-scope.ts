// Helper per le eccezioni "questa e successive": manipolazione dell'UNTIL nella RRULE.

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatRecurrenceUntil(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

// Imposta/sostituisce UNTIL in una RRULE (rimuove eventuale COUNT, incompatibile con UNTIL).
export function withRecurrenceUntil(rule: string, until: Date): string {
  const parts = rule
    .split(';')
    .filter((part) => part && !/^UNTIL=/i.test(part) && !/^COUNT=/i.test(part))

  parts.push(`UNTIL=${formatRecurrenceUntil(until)}`)

  return parts.join(';')
}

export function getRecurrenceUntil(rule: string): Date | null {
  const match = rule.match(/UNTIL=(\d{8}T\d{6}Z)/i)

  if (!match?.[1]) {
    return null
  }

  const value = match[1]
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? null : date
}
