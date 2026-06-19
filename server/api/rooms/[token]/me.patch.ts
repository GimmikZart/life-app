import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { roomParticipants } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { getRoomByToken, getRoomParticipant } from '../../../utils/rooms'

// Aggiorna cosa la room vede di me ('clear' = dettagli, 'busy' = solo occupato).
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Room token is required.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const visibility = body.visibility === 'clear' || body.visibility === 'busy' ? body.visibility : null

  if (!visibility) {
    throw createError({ statusCode: 400, statusMessage: 'visibility must be clear or busy.' })
  }

  const room = await getRoomByToken(token)

  if (!room) {
    throw createError({ statusCode: 404, statusMessage: 'Room not found.' })
  }

  const participant = await getRoomParticipant(room.id, currentUser.id)

  if (!participant) {
    throw createError({ statusCode: 403, statusMessage: 'You are not in this room.' })
  }

  const db = useDatabase()
  await db
    .update(roomParticipants)
    .set({ visibility })
    .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, currentUser.id)))

  return { visibility }
})
