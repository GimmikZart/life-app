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

export const calendars = pgTable(
  'calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#2563eb'),
    type: calendarTypeEnum('type').notNull().default('personal')
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
    status: calendarMemberStatusEnum('status').notNull().default('pending')
  },
  (table) => [
    unique('calendar_members_calendar_id_user_id_unique').on(table.calendarId, table.userId),
    index('calendar_members_user_status_idx').on(table.userId, table.status)
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
      .default(sql`'{}'::jsonb`)
  },
  (table) => [
    unique('relationships_user_id_target_user_id_unique').on(table.userId, table.targetUserId),
    index('relationships_target_user_id_idx').on(table.targetUserId)
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
