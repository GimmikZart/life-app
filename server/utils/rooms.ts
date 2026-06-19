import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import { roomParticipants, rooms } from '../database/schema'

export async function getRoomByToken(token: string) {
  const db = useDatabase()
  const [room] = await db.select().from(rooms).where(eq(rooms.token, token)).limit(1)

  return room
}

export function isRoomExpired(room: { expiresAt: Date | null }) {
  return Boolean(room.expiresAt && room.expiresAt.getTime() < Date.now())
}

export async function getRoomParticipant(roomId: string, userId: string) {
  const db = useDatabase()
  const [participant] = await db
    .select()
    .from(roomParticipants)
    .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)))
    .limit(1)

  return participant
}
