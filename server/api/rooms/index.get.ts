import { and, eq, gt, isNull, or } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { roomParticipants, rooms } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

// Le room attive a cui partecipo (incluse quelle che ho creato), non scadute.
export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()
  const now = new Date()

  const myRooms = await db
    .select({
      id: rooms.id,
      token: rooms.token,
      title: rooms.title,
      expiresAt: rooms.expiresAt,
      creatorId: rooms.creatorId
    })
    .from(roomParticipants)
    .innerJoin(rooms, eq(rooms.id, roomParticipants.roomId))
    .where(and(
      eq(roomParticipants.userId, currentUser.id),
      or(isNull(rooms.expiresAt), gt(rooms.expiresAt, now))
    ))

  return {
    rooms: myRooms.map((room) => ({
      id: room.id,
      token: room.token,
      title: room.title,
      expiresAt: room.expiresAt,
      isCreator: room.creatorId === currentUser.id
    }))
  }
})
