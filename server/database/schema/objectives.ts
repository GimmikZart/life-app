import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'

import { calendarEvents } from './calendar'
import { users } from './users'

// Obiettivi (Ciclo 4). Direzioni verso cui l'utente vuole andare. Un obiettivo
// e un contenitore logico di Action: nel modello corretto le Action sono eventi,
// quindi il collegamento e evento <-> obiettivo (event_objectives).
export const objectives = pgTable(
  'objectives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    targetDate: date('target_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('objectives_user_id_idx').on(table.userId)
  ]
)

// Ponte N:N evento <-> obiettivo. Un evento "diventa Action" anche associandolo
// a un obiettivo. ON DELETE CASCADE su entrambi i lati: il collegamento esiste
// solo finche esistono sia l'evento sia l'obiettivo.
export const eventObjectives = pgTable(
  'event_objectives',
  {
    calendarEventId: uuid('calendar_event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    objectiveId: uuid('objective_id')
      .notNull()
      .references(() => objectives.id, { onDelete: 'cascade' })
  },
  (table) => [
    unique('event_objectives_event_objective_unique').on(table.calendarEventId, table.objectiveId),
    index('event_objectives_objective_idx').on(table.objectiveId)
  ]
)
