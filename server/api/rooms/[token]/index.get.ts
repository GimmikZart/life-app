import { eq } from 'drizzle-orm'

import { useDatabase } from '../../../database/client'
import { roomParticipants, users } from '../../../database/schema'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { getRoomByToken, getRoomParticipant, isRoomExpired } from '../../../utils/rooms'

// Dettaglio room. Se sono partecipante restituisco anche la lista partecipanti e
// la mia visibilità; altrimenti solo i meta minimi + needsJoin.
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

  const myParticipant = await getRoomParticipant(room.id, currentUser.id)
  const expired = isRoomExpired(room)
  const meta = {
    id: room.id,
    token: room.token,
    title: room.title,
    expiresAt: room.expiresAt,
    isCreator: room.creatorId === currentUser.id
  }

  if (!myParticipant) {
    return { room: meta, expired, isParticipant: false, myVisibility: null, participants: [] }
  }

  const db = useDatabase()
  const participants = await db
    .select({
      userId: roomParticipants.userId,
      visibility: roomParticipants.visibility,
      name: users.name,
      email: users.email
    })
    .from(roomParticipants)
    .innerJoin(users, eq(users.id, roomParticipants.userId))
    .where(eq(roomParticipants.roomId, room.id))

  return {
    room: meta,
    expired,
    isParticipant: true,
    myVisibility: myParticipant.visibility,
    participants
  }
})
