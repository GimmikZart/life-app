import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { skillWeights, skills } from '../database/schema'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Database = ReturnType<typeof useDatabase>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type SkillPayload = {
  name: string
  parentSkillId: string | null
}

export function parseSkillPayload(body: Record<string, unknown>): SkillPayload {
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Il nome della skill e obbligatorio.' })
  }

  let parentSkillId: string | null = null

  if (typeof body.parentSkillId === 'string' && body.parentSkillId.trim()) {
    const candidate = body.parentSkillId.trim()

    if (!UUID_RE.test(candidate)) {
      throw createError({ statusCode: 400, statusMessage: 'parentSkillId non valido.' })
    }

    parentSkillId = candidate
  }

  return { name, parentSkillId }
}

// Distribuisce equamente i pesi delle sub-skill di una macro-skill, somma = 100
// (il resto della divisione va alla prima sub-skill). Sostituisce le righe
// esistenti. Da chiamare dopo aver aggiunto/rimosso una sub-skill.
export async function redistributeSkillWeights(tx: Transaction, parentSkillId: string) {
  const children = await tx
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.parentSkillId, parentSkillId))
    .orderBy(skills.createdAt)

  await tx.delete(skillWeights).where(eq(skillWeights.parentSkillId, parentSkillId))

  if (!children.length) {
    return
  }

  const base = Math.floor(100 / children.length)
  const remainder = 100 - base * children.length

  await tx.insert(skillWeights).values(
    children.map((child, index) => ({
      parentSkillId,
      childSkillId: child.id,
      weight: base + (index === 0 ? remainder : 0)
    }))
  )
}

export type SkillWeightInput = { childSkillId: string; weight: number }

export function parseSkillWeightsPayload(body: Record<string, unknown>): SkillWeightInput[] {
  const raw = Array.isArray(body.weights) ? body.weights : []
  const weights: SkillWeightInput[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const record = item as Record<string, unknown>
    const childSkillId = typeof record.childSkillId === 'string' ? record.childSkillId.trim() : ''
    const weight = typeof record.weight === 'number' ? record.weight : Number(record.weight)

    if (!UUID_RE.test(childSkillId) || !Number.isInteger(weight) || weight < 0 || weight > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Pesi non validi (interi 0-100 con childSkillId valido).' })
    }

    weights.push({ childSkillId, weight })
  }

  if (!weights.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nessun peso fornito.' })
  }

  const sum = weights.reduce((total, item) => total + item.weight, 0)

  if (sum !== 100) {
    throw createError({ statusCode: 400, statusMessage: `La somma dei pesi deve essere 100 (attuale: ${sum}).` })
  }

  return weights
}

// Verifica che una skill appartenga all'utente; ritorna la riga o lancia 404.
export async function requireOwnedSkill(userId: string, skillId: string) {
  const db = useDatabase()
  const [skill] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)))
    .limit(1)

  if (!skill) {
    throw createError({ statusCode: 404, statusMessage: 'Skill non trovata.' })
  }

  return skill
}
