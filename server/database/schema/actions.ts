import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'

import { users } from './users'

// Action Engine (Ciclo 3). Una Action e l'unita autonoma del sistema: ha un peso
// (1|2|3), una frequenza (config JSON, struttura definita nel Sotto-Ciclo 3.2) e
// puo generare occorrenze sul Calendario (Sotto-Ciclo 3.3) collegate via
// `calendar_events.action_id`.
export const actions = pgTable(
  'actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Peso dell'impegno: 1 = routine leggera, 2 = impegno medio, 3 = sforzo
    // significativo (Project Knowledge v2, sez. 3.2). Il vincolo IN (1,2,3) e
    // applicato a livello DB con un CHECK nella migrazione.
    weight: integer('weight').notNull().default(1),
    // Calendario su cui il Sotto-Ciclo 3.3 generera gli eventi/occorrenze di
    // questa Action. NULL = usa il calendario primario dell'utente. Colonna
    // semplice qui: la FK verso calendars.id (ON DELETE SET NULL) e dichiarata
    // nella migrazione, per non reintrodurre l'import circolare con calendar.ts.
    targetCalendarId: uuid('target_calendar_id'),
    // Config della frequenza (giornaliera/settimanale/mensile/data specifica).
    // Qui e solo un contenitore: la struttura concreta arriva nel Sotto-Ciclo 3.2.
    frequency: jsonb('frequency')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isTemplate: boolean('is_template').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('actions_user_id_idx').on(table.userId)
  ]
)

// Log dei completamenti. Una riga = "questa occorrenza pianificata e stata
// completata". L'occorrenza e identificata in modo univoco da
// (action_id, occurrence_date): questo rende non ambiguo l'annullamento
// (Sotto-Ciclo 3.4), che cancella la riga per chiave logica e non per ricerca
// approssimata su `completed_at`.
//
// `calendar_event_id` collega il completamento all'evento calendario generato
// (Sotto-Ciclo 3.3) quando esiste. E una colonna semplice qui: la foreign key
// verso `calendar_events.id` (con ON DELETE SET NULL) e dichiarata nella
// migrazione, per evitare un import circolare tra questo file e `calendar.ts`
// (che a sua volta referenzia `actions.id`).
export const actionCompletions = pgTable(
  'action_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actionId: uuid('action_id')
      .notNull()
      .references(() => actions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calendarEventId: uuid('calendar_event_id'),
    // Data dell'istanza pianificata completata (es. "la sessione di lunedi 16
    // giugno"), indipendente da quando e stata marcata (`completedAt`).
    occurrenceDate: date('occurrence_date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
    // Placeholder fino al Ciclo 4 (calcolo punti/Skill).
    pointsAwarded: jsonb('points_awarded')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    notes: text('notes')
  },
  (table) => [
    // Non e possibile completare due volte la stessa occorrenza della stessa Action.
    unique('action_completions_action_id_occurrence_date_unique').on(
      table.actionId,
      table.occurrenceDate
    ),
    index('action_completions_action_id_idx').on(table.actionId),
    index('action_completions_calendar_event_id_idx').on(table.calendarEventId)
  ]
)
