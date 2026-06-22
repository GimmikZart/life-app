import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'

import { users } from './users'

export const calendarTypeEnum = pgEnum('calendar_type', [
  'personal',
  'couple',
  'family',
  'work',
  'custom'
])

export const calendarPermissionEnum = pgEnum('calendar_permission', [
  'owner',
  'editor',
  'viewer'
])

export const calendarMemberStatusEnum = pgEnum('calendar_member_status', [
  'pending',
  'accepted',
  'declined'
])

export const eventVisibilityEnum = pgEnum('event_visibility', [
  'clear',
  'busy',
  'hidden'
])

// Stato dell'handshake di connessione tra due utenti (relazione reciproca).
export const relationshipStatusEnum = pgEnum('relationship_status', [
  'pending',
  'accepted',
  'declined'
])

export const calendars = pgTable(
  'calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#2563eb'),
    type: calendarTypeEnum('type').notNull().default('personal'),
    // Token per la condivisione via link pubblico: se valorizzato, chiunque abbia
    // il link (ed e' registrato) puo' unirsi come viewer. Null = nessun link attivo.
    shareToken: text('share_token').unique()
  },
  (table) => [
    index('calendars_user_id_idx').on(table.userId)
  ]
)

export const calendarMembers = pgTable(
  'calendar_members',
  {
    calendarId: uuid('calendar_id')
      .notNull()
      .references(() => calendars.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: calendarPermissionEnum('permission').notNull().default('viewer'),
    status: calendarMemberStatusEnum('status').notNull().default('pending'),
    // Layer model (per-utente, non sul calendario): preferenze di integrazione
    // nella "vista ufficiale" dell'utente. `isPrimary` = calendario principale
    // (destinazione di default dei nuovi eventi, sempre integrato); `autoIntegrate`
    // = gli eventi di questo calendario compaiono nella vista ufficiale e contano
    // come "occupato" nel calcolo della disponibilita.
    isPrimary: boolean('is_primary').notNull().default(false),
    autoIntegrate: boolean('auto_integrate').notNull().default(false)
  },
  (table) => [
    unique('calendar_members_calendar_id_user_id_unique').on(table.calendarId, table.userId),
    index('calendar_members_user_status_idx').on(table.userId, table.status),
    // Un solo calendario primario per utente (vincolo applicato a livello DB).
    uniqueIndex('calendar_members_one_primary_per_user_unique')
      .on(table.userId)
      .where(sql`${table.isPrimary} = true`)
  ]
)

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calendarId: uuid('calendar_id')
      .notNull()
      .references(() => calendars.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrenceRule: text('recurrence_rule'),
    visibilityDefault: eventVisibilityEnum('visibility_default').notNull().default('clear'),
    source: text('source').notNull().default('life_app'),
    externalId: text('external_id'),
    // Ciclo 3 colleghera questo campo a actions.id con una foreign key reale.
    actionId: uuid('action_id')
  },
  (table) => [
    index('calendar_events_calendar_start_idx').on(table.calendarId, table.startAt),
    index('calendar_events_user_start_idx').on(table.userId, table.startAt),
    unique('calendar_events_source_external_id_unique').on(table.source, table.externalId)
  ]
)

export const relationships = pgTable(
  'relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    relationshipType: text('relationship_type').notNull(),
    visibilityRules: jsonb('visibility_rules')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Handshake reciproco: una connessione e attiva solo quando entrambe le
    // direzioni (A->B e B->A) sono 'accepted'. Ogni utente controlla la propria riga.
    status: relationshipStatusEnum('status').notNull().default('pending')
  },
  (table) => [
    unique('relationships_user_id_target_user_id_unique').on(table.userId, table.targetUserId),
    index('relationships_target_user_id_idx').on(table.targetUserId),
    index('relationships_target_status_idx').on(table.targetUserId, table.status)
  ]
)

export const eventVisibilityOverrides = pgTable(
  'event_visibility_overrides',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    visibility: eventVisibilityEnum('visibility').notNull()
  },
  (table) => [
    unique('event_visibility_overrides_event_id_target_user_id_unique').on(
      table.eventId,
      table.targetUserId
    ),
    index('event_visibility_overrides_target_user_id_idx').on(table.targetUserId)
  ]
)

export const eventAssociations = pgTable(
  'event_associations',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    associatedUserId: uuid('associated_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayConfig: jsonb('display_config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`)
  },
  (table) => [
    unique('event_associations_event_id_associated_user_id_unique').on(
      table.eventId,
      table.associatedUserId
    ),
    index('event_associations_associated_user_id_idx').on(table.associatedUserId)
  ]
)

// Integrazione manuale PER-UTENTE: una riga = "questo utente vuole questo evento
// nella propria vista ufficiale". Sostituisce il vecchio booleano owner-only
// `calendar_events.pinned_to_primary`, cosi posso fissare anche eventi non miei
// (es. da un calendario condiviso o pubblico) che ho il permesso di vedere.
export const eventOfficialPins = pgTable(
  'event_official_pins',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (table) => [
    unique('event_official_pins_event_id_user_id_unique').on(table.eventId, table.userId),
    index('event_official_pins_user_id_idx').on(table.userId)
  ]
)

// Eccezioni di ricorrenza: una riga = override/cancellazione di UNA singola
// occorrenza di una serie ricorrente, identificata da `occurrenceDate` (la data
// di inizio generata dalla RRULE). isCancelled = occorrenza eliminata; altrimenti
// i campi non-null sovrascrivono quelli della serie solo per quell'occorrenza.
export const eventExceptions = pgTable(
  'event_exceptions',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    occurrenceDate: timestamp('occurrence_date', { withTimezone: true }).notNull(),
    isCancelled: boolean('is_cancelled').notNull().default(false),
    title: text('title'),
    category: text('category'),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    visibilityDefault: eventVisibilityEnum('visibility_default')
  },
  (table) => [
    unique('event_exceptions_event_id_occurrence_date_unique').on(table.eventId, table.occurrenceDate),
    index('event_exceptions_event_id_idx').on(table.eventId)
  ]
)
