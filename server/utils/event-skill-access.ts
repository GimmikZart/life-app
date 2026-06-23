import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { calendarEvents, skills } from '../database/schema'

export type EventSkillBody = {
  calendarEventId: string
  skillId: string
  contributionWeight: number
  type: 'primary' | 'secondary'
}

// Un collegamento evento<->skill e ammesso solo se l'utente possiede entrambi.
export async function assertOwnsEventAndSkill(userId: string, calendarEventId: string, skillId: string) {
  const db = useDatabase()

  const [ownedEvent] = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, calendarEventId), eq(calendarEvents.userId, userId)))
    .limit(1)

  if (!ownedEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Evento non trovato.' })
  }

  const [ownedSkill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)))
    .limit(1)

  if (!ownedSkill) {
    throw createError({ statusCode: 404, statusMessage: 'Skill non trovata.' })
  }
}

export function parseEventSkillBody(body: Record<string, unknown>): EventSkillBody {
  const calendarEventId = typeof body.calendarEventId === 'string' ? body.calendarEventId.trim() : ''
  const skillId = typeof body.skillId === 'string' ? body.skillId.trim() : ''

  if (!calendarEventId || !skillId) {
    throw createError({ statusCode: 400, statusMessage: 'calendarEventId e skillId sono obbligatori.' })
  }

  const contributionWeight = typeof body.contributionWeight === 'number'
    ? body.contributionWeight
    : Number(body.contributionWeight)

  if (!Number.isInteger(contributionWeight) || contributionWeight < 0 || contributionWeight > 100) {
    throw createError({ statusCode: 400, statusMessage: 'contributionWeight non valido (intero 0-100).' })
  }

  const type = body.type === 'secondary' ? 'secondary' : 'primary'

  return { calendarEventId, skillId, contributionWeight, type }
}
