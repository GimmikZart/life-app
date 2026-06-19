import { useDatabase } from '../../database/client'
import { roomParticipants, rooms } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

// Crea una room momentanea di confronto disponibilità. Il creatore entra subito
// come partecipante (visibilità di default 'busy'). La room scade dopo N ore.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
  const durationHours = typeof body.durationHours === 'number' && body.durationHours > 0
    ? Math.min(Math.floor(body.durationHours), 24 * 30)
    : 24
  const token = globalThis.crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + durationHours * 3_600_000)
  const db = useDatabase()

  const room = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(rooms)
      .values({ token, creatorId: currentUser.id, title, expiresAt })
      .returning()

    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Unable to create room.' })
    }

    await tx.insert(roomParticipants).values({ roomId: created.id, userId: currentUser.id, visibility: 'busy' })

    return created
  })

  return { room }
})
