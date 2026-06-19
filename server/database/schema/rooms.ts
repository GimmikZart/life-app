import { sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { users } from './users'

// Visibilità che un partecipante espone alla room (scelta per-room, indipendente
// dalle relazioni permanenti).
export const roomParticipantVisibilityEnum = pgEnum('room_participant_visibility', [
  'clear',
  'busy'
])

// Room momentanea di confronto disponibilità: effimera tramite expires_at.
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`)
  },
  (table) => [
    index('rooms_creator_id_idx').on(table.creatorId)
  ]
)

export const roomParticipants = pgTable(
  'room_participants',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    visibility: roomParticipantVisibilityEnum('visibility').notNull().default('busy'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().default(sql`now()`)
  },
  (table) => [
    unique('room_participants_room_id_user_id_unique').on(table.roomId, table.userId),
    index('room_participants_user_id_idx').on(table.userId)
  ]
)
