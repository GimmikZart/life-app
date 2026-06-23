import { sql } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'

import { users } from './users'

// Catalogo badge (dati condivisi, non per-utente). `key` e l'identificatore
// stabile usato dalla logica di assegnazione (4.7). `criteria` descrive in JSON
// la condizione di sblocco.
export const badges = pgTable(
  'badges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    icon: text('icon'),
    criteria: jsonb('criteria')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`)
  }
)

// Badge ottenuti da un utente. Unique (user_id, badge_id) = idempotenza
// dell'assegnazione (4.7): si tenta sempre l'insert e si gestisce il conflitto.
export const userBadges = pgTable(
  'user_badges',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badgeId: uuid('badge_id')
      .notNull()
      .references(() => badges.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique('user_badges_user_badge_unique').on(table.userId, table.badgeId),
    index('user_badges_user_idx').on(table.userId)
  ]
)
