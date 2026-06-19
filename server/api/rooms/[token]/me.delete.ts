import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { roomParticipants } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { getRoomByToken } from '../../../utils/rooms'

// Esco dalla room.
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

  const db = useDatabase()
  await db
    .delete(roomParticipants)
    .where(and(eq(roomParticipants.roomId, room.id), eq(roomParticipants.userId, currentUser.id)))

  return { ok: true }
})
