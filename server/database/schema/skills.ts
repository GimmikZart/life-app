import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'

import { calendarEvents } from './calendar'
import { users } from './users'

// Tipo di contributo di un evento verso una skill (Project Knowledge v2 sez. 3.4):
// primary = l'evento e fatto apposta per quella skill; secondary = beneficio collaterale.
export const skillContributionTypeEnum = pgEnum('skill_contribution_type', ['primary', 'secondary'])

// Skill: rappresentazione misurabile di "chi l'utente sta diventando". Gerarchia
// macro/sub tramite parent_skill_id (self-reference). decay_coefficient e il
// coefficiente k del deterioramento del Momentum (usato davvero nel 4.5a; qui ha
// un default fisso per non richiedere una migrazione successiva).
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    parentSkillId: uuid('parent_skill_id').references((): AnyPgColumn => skills.id, {
      onDelete: 'cascade'
    }),
    decayCoefficient: real('decay_coefficient').notNull().default(0.1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('skills_user_id_idx').on(table.userId),
    index('skills_parent_idx').on(table.parentSkillId)
  ]
)

// Peso di una sub-skill rispetto alla macro (0-100, somma per macro = 100,
// validata a livello applicativo nel 4.3).
export const skillWeights = pgTable(
  'skill_weights',
  {
    parentSkillId: uuid('parent_skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    childSkillId: uuid('child_skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    weight: integer('weight').notNull().default(0)
  },
  (table) => [
    unique('skill_weights_parent_child_unique').on(table.parentSkillId, table.childSkillId),
    index('skill_weights_child_idx').on(table.childSkillId)
  ]
)

// Ponte N:N evento <-> skill con parametri. Un evento "diventa Action" anche
// associandolo a una skill. contribution_weight 0-100; type primary/secondary.
export const eventSkills = pgTable(
  'event_skills',
  {
    calendarEventId: uuid('calendar_event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    contributionWeight: integer('contribution_weight').notNull().default(100),
    type: skillContributionTypeEnum('type').notNull().default('primary')
  },
  (table) => [
    unique('event_skills_event_skill_unique').on(table.calendarEventId, table.skillId),
    index('event_skills_skill_idx').on(table.skillId)
  ]
)

// Snapshot periodico di Level/Momentum di una skill (NON un ledger: il ledger
// granulare e event_completions). Scritto a ogni variazione effettiva (4.4b/4.5).
export const skillProgress = pgTable(
  'skill_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillLevel: real('skill_level').notNull().default(0),
    skillMomentum: real('skill_momentum').notNull().default(0),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('skill_progress_skill_recorded_idx').on(table.skillId, table.recordedAt)
  ]
)

// Log dei completamenti per-occorrenza. Un evento-Action svolto = una riga.
// occurrence_date distingue le occorrenze di un evento ricorrente; e il
// riferimento per streak/consistency (non completed_at, che puo essere in ritardo).
// ON DELETE CASCADE: l'evento e la fonte di verita; se sparisce, spariscono le
// sue occorrenze e i relativi completamenti (coerente col calcolo streak).
export const eventCompletions = pgTable(
  'event_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    calendarEventId: uuid('calendar_event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    occurrenceDate: date('occurrence_date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
    pointsAwarded: jsonb('points_awarded')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    notes: text('notes')
  },
  (table) => [
    unique('event_completions_event_occurrence_unique').on(table.calendarEventId, table.occurrenceDate),
    index('event_completions_user_idx').on(table.userId)
  ]
)
