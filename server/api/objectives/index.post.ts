import { useDatabase } from '../../database/client'
import { objectives } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'
import { parseObjectivePayload } from '../../utils/objective-validation'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const payload = parseObjectivePayload(await readBody<Record<string, unknown>>(event))
  const db = useDatabase()

  const [objective] = await db
    .insert(objectives)
    .values({
      userId: currentUser.id,
      title: payload.title,
      description: payload.description,
      targetDate: payload.targetDate
    })
    .returning()

  if (!objective) {
    throw createError({ statusCode: 500, statusMessage: 'Impossibile creare l\'obiettivo.' })
  }

  return { objective }
})
