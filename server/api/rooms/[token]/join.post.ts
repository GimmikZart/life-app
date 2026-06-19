import { useDatabase } from '../../../database/client'
import { roomParticipants } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { getRoomByToken, isRoomExpired } from '../../../utils/rooms'

// Entra in una room tramite token (link o invito). Idempotente.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Room token is required.' })
  }

  const room = await getRoomByToken(token)

  if (!room) {
    throw createError({ statusCode: 404, statusMessage: 'Room not found.' })
  }

  if (isRoomExpired(room)) {
    throw createError({ statusCode: 403, statusMessage: 'This room has expired.' })
  }

  const db = useDatabase()
  await db
    .insert(roomParticipants)
    .values({ roomId: room.id, userId: currentUser.id, visibility: 'busy' })
    .onConflictDoNothing()

  return { ok: true }
})
