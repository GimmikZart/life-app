const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type ObjectivePayload = {
  title: string
  description: string | null
  targetDate: string | null
}

export function parseObjectivePayload(body: Record<string, unknown>): ObjectivePayload {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' && body.description.trim()
    ? body.description.trim()
    : null

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Il titolo dell\'obiettivo e obbligatorio.' })
  }

  let targetDate: string | null = null

  if (typeof body.targetDate === 'string' && body.targetDate.trim()) {
    const candidate = body.targetDate.trim()

    if (!DATE_RE.test(candidate) || Number.isNaN(new Date(`${candidate}T00:00:00`).getTime())) {
      throw createError({ statusCode: 400, statusMessage: 'Data target non valida (attesa YYYY-MM-DD).' })
    }

    targetDate = candidate
  }

  return { title, description, targetDate }
}
