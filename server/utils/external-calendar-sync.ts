import { and, eq, gt, inArray, lt } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import {
  calendarEvents,
  calendarMembers,
  calendars,
  externalCalendarConnections,
  externalCalendarSyncJobs,
  type ExternalCalendarProvider,
  type ExternalCalendarSyncOperation
} from '../database/schema'
import {
  encryptExternalSecret,
  decryptExternalSecret
} from './external-calendar-crypto'
import {
  type ExternalEventPayload,
  getExternalProvider,
  providerColor,
  providerDisplayName
} from './external-calendar-providers'

export function parseExternalProvider(value: string | undefined): ExternalCalendarProvider {
  if (value === 'google' || value === 'microsoft') {
    return value
  }

  throw createError({ statusCode: 400, statusMessage: 'Unsupported calendar provider.' })
}

type ConnectionRow = typeof externalCalendarConnections.$inferSelect
type CalendarEventRow = typeof calendarEvents.$inferSelect

type OAuthConnectionInput = {
  userId: string
  provider: ExternalCalendarProvider
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
  scope?: string | null
  providerAccountEmail?: string | null
}

export async function upsertExternalCalendarConnection(input: OAuthConnectionInput) {
  const db = useDatabase()
  const now = new Date()
  const existing = await getExternalConnection(input.userId, input.provider)
  const refreshTokenEncrypted = input.refreshToken
    ? encryptExternalSecret(input.refreshToken)
    : existing?.refreshTokenEncrypted ?? null
  const [connection] = await db
    .insert(externalCalendarConnections)
    .values({
      userId: input.userId,
      provider: input.provider,
      providerAccountEmail: input.providerAccountEmail ?? null,
      providerCalendarId: 'primary',
      providerCalendarName: providerDisplayName(input.provider),
      accessTokenEncrypted: encryptExternalSecret(input.accessToken) as string,
      refreshTokenEncrypted,
      expiresAt: input.expiresAt ?? null,
      scope: input.scope ?? null,
      status: 'connected',
      lastSyncError: null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [externalCalendarConnections.userId, externalCalendarConnections.provider],
      set: {
        providerAccountEmail: input.providerAccountEmail ?? existing?.providerAccountEmail ?? null,
        accessTokenEncrypted: encryptExternalSecret(input.accessToken) as string,
        refreshTokenEncrypted,
        expiresAt: input.expiresAt ?? null,
        scope: input.scope ?? null,
        status: 'connected',
        lastSyncError: null,
        updatedAt: now
      }
    })
    .returning()

  return ensureExternalCalendar(connection)
}

export async function getExternalConnection(userId: string, provider: ExternalCalendarProvider) {
  const [connection] = await useDatabase()
    .select()
    .from(externalCalendarConnections)
    .where(and(
      eq(externalCalendarConnections.userId, userId),
      eq(externalCalendarConnections.provider, provider)
    ))
    .limit(1)

  return connection ?? null
}

export async function getExternalConnectionForCalendar(calendarId: string, userId: string) {
  const [connection] = await useDatabase()
    .select()
    .from(externalCalendarConnections)
    .where(and(
      eq(externalCalendarConnections.calendarId, calendarId),
      eq(externalCalendarConnections.userId, userId)
    ))
    .limit(1)

  return connection ?? null
}

export async function listExternalCalendarConnections(userId: string) {
  return useDatabase()
    .select({
      id: externalCalendarConnections.id,
      provider: externalCalendarConnections.provider,
      providerAccountEmail: externalCalendarConnections.providerAccountEmail,
      calendarId: externalCalendarConnections.calendarId,
      status: externalCalendarConnections.status,
      lastSyncedAt: externalCalendarConnections.lastSyncedAt,
      lastSyncError: externalCalendarConnections.lastSyncError,
      webhookExpiresAt: externalCalendarConnections.webhookExpiresAt,
      createdAt: externalCalendarConnections.createdAt
    })
    .from(externalCalendarConnections)
    .where(eq(externalCalendarConnections.userId, userId))
}

export async function deleteExternalCalendarConnection(userId: string, provider: ExternalCalendarProvider) {
  const connection = await getExternalConnection(userId, provider)

  if (!connection) {
    return
  }

  try {
    await getExternalProvider(connection.provider).stopWebhook(connection)
  } catch {
    // Disconnection must remain possible even if the remote webhook was already gone.
  }

  const db = useDatabase()

  if (connection.calendarId) {
    await db.delete(calendars).where(eq(calendars.id, connection.calendarId))
  }

  await db
    .delete(externalCalendarConnections)
    .where(eq(externalCalendarConnections.id, connection.id))
}

export async function ensureExternalCalendar(connection: ConnectionRow) {
  if (connection.calendarId) {
    const [existingCalendar] = await useDatabase()
      .select({ id: calendars.id })
      .from(calendars)
      .where(eq(calendars.id, connection.calendarId))
      .limit(1)

    if (existingCalendar) {
      return connection
    }
  }

  const db = useDatabase()
  const name = providerDisplayName(connection.provider)
  const color = providerColor(connection.provider)
  const nextConnection = await db.transaction(async (tx) => {
    const [calendar] = await tx
      .insert(calendars)
      .values({
        userId: connection.userId,
        name,
        color,
        type: 'custom'
      })
      .returning()

    await tx.insert(calendarMembers).values({
      calendarId: calendar.id,
      userId: connection.userId,
      permission: 'owner',
      status: 'accepted',
      isPrimary: false,
      autoIntegrate: true
    })

    const [updated] = await tx
      .update(externalCalendarConnections)
      .set({
        calendarId: calendar.id,
        providerCalendarName: name,
        updatedAt: new Date()
      })
      .where(eq(externalCalendarConnections.id, connection.id))
      .returning()

    return updated
  })

  return nextConnection
}

export async function syncExternalCalendarConnection(userId: string, provider: ExternalCalendarProvider) {
  const connection = await getExternalConnection(userId, provider)

  if (!connection) {
    throw createError({ statusCode: 404, statusMessage: 'Calendar provider is not connected.' })
  }

  return syncExternalCalendarConnectionById(connection.id)
}

export async function syncExternalCalendarConnectionById(connectionId: string) {
  const db = useDatabase()
  const [loadedConnection] = await db
    .select()
    .from(externalCalendarConnections)
    .where(eq(externalCalendarConnections.id, connectionId))
    .limit(1)

  if (!loadedConnection) {
    throw createError({ statusCode: 404, statusMessage: 'Calendar connection not found.' })
  }

  await processExternalSyncJobs(loadedConnection.id)
  const connection = await ensureExternalCalendar(loadedConnection)

  if (!connection.calendarId) {
    throw createError({ statusCode: 500, statusMessage: 'External calendar could not be created.' })
  }

  const { from, to } = getSyncWindow()
  const adapter = getExternalProvider(connection.provider)

  try {
    const remoteEvents = await adapter.listEvents(connection, from, to)
    const seenExternalIds = new Set<string>()
    let imported = 0
    let deleted = 0

    for (const remoteEvent of remoteEvents) {
      seenExternalIds.add(remoteEvent.externalId)
      const [existingEvent] = await db
        .select()
        .from(calendarEvents)
        .where(and(
          eq(calendarEvents.externalConnectionId, connection.id),
          eq(calendarEvents.externalCalendarId, remoteEvent.externalCalendarId),
          eq(calendarEvents.externalId, remoteEvent.externalId)
        ))
        .limit(1)

      if (remoteEvent.isCancelled) {
        if (existingEvent) {
          await db.delete(calendarEvents).where(eq(calendarEvents.id, existingEvent.id))
          deleted += 1
        }

        continue
      }

      if (existingEvent?.syncStatus === 'pending' || existingEvent?.syncStatus === 'error') {
        continue
      }

      if (existingEvent) {
        await db
          .update(calendarEvents)
          .set({
            title: remoteEvent.title,
            startAt: remoteEvent.startAt,
            endAt: remoteEvent.endAt,
            isRecurring: false,
            recurrenceRule: null,
            externalUpdatedAt: remoteEvent.externalUpdatedAt,
            syncStatus: 'synced',
            syncError: null,
            updatedAt: new Date()
          })
          .where(eq(calendarEvents.id, existingEvent.id))
      } else {
        await db.insert(calendarEvents).values({
          userId: connection.userId,
          calendarId: connection.calendarId,
          title: remoteEvent.title,
          category: null,
          startAt: remoteEvent.startAt,
          endAt: remoteEvent.endAt,
          isRecurring: false,
          recurrenceRule: null,
          visibilityDefault: 'clear',
          source: connection.provider,
          externalConnectionId: connection.id,
          externalCalendarId: remoteEvent.externalCalendarId,
          externalId: remoteEvent.externalId,
          externalUpdatedAt: remoteEvent.externalUpdatedAt,
          syncStatus: 'synced',
          syncError: null,
          updatedAt: new Date()
        })
      }

      imported += 1
    }

    const localExternalEvents = await db
      .select({
        id: calendarEvents.id,
        externalId: calendarEvents.externalId,
        syncStatus: calendarEvents.syncStatus
      })
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.externalConnectionId, connection.id),
        lt(calendarEvents.startAt, to),
        gt(calendarEvents.endAt, from)
      ))

    for (const localEvent of localExternalEvents) {
      if (
        localEvent.externalId
        && !seenExternalIds.has(localEvent.externalId)
        && localEvent.syncStatus !== 'pending'
        && localEvent.syncStatus !== 'error'
      ) {
        await db.delete(calendarEvents).where(eq(calendarEvents.id, localEvent.id))
        deleted += 1
      }
    }

    await db
      .update(externalCalendarConnections)
      .set({
        lastSyncedAt: new Date(),
        lastSyncError: null,
        status: 'connected',
        updatedAt: new Date()
      })
      .where(eq(externalCalendarConnections.id, connection.id))

    await adapter.setupWebhook(connection)

    return { imported, deleted }
  } catch (error) {
    const message = getErrorMessage(error)
    await db
      .update(externalCalendarConnections)
      .set({
        lastSyncError: message,
        status: 'error',
        updatedAt: new Date()
      })
      .where(eq(externalCalendarConnections.id, connection.id))

    throw createError({ statusCode: 502, statusMessage: message })
  }
}

export async function enqueueExternalEventSync(eventId: string, operation: ExternalCalendarSyncOperation) {
  const db = useDatabase()
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1)

  if (!event?.externalConnectionId) {
    return
  }

  const payload = buildSyncPayload(event)

  await db.insert(externalCalendarSyncJobs).values({
    userId: event.userId,
    connectionId: event.externalConnectionId,
    eventId: event.id,
    operation,
    status: 'pending',
    payload,
    updatedAt: new Date()
  })

  await db
    .update(calendarEvents)
    .set({ syncStatus: 'pending', syncError: null, updatedAt: new Date() })
    .where(eq(calendarEvents.id, event.id))

  await processExternalSyncJobs(event.externalConnectionId, 5)
}

export async function enqueueExternalDelete(event: Pick<CalendarEventRow,
  'id' | 'userId' | 'externalConnectionId' | 'externalCalendarId' | 'externalId' | 'title' | 'startAt' | 'endAt' | 'isRecurring' | 'recurrenceRule' | 'category'
>) {
  if (!event.externalConnectionId || !event.externalId) {
    return
  }

  await useDatabase().insert(externalCalendarSyncJobs).values({
    userId: event.userId,
    connectionId: event.externalConnectionId,
    eventId: null,
    operation: 'delete',
    status: 'pending',
    payload: {
      externalId: event.externalId,
      externalCalendarId: event.externalCalendarId,
      event: buildExternalEventPayload(event)
    },
    updatedAt: new Date()
  })

  await processExternalSyncJobs(event.externalConnectionId, 5)
}

export async function processExternalSyncJobs(connectionId: string, limit = 20) {
  const db = useDatabase()
  const [connection] = await db
    .select()
    .from(externalCalendarConnections)
    .where(eq(externalCalendarConnections.id, connectionId))
    .limit(1)

  if (!connection) {
    return { processed: 0, failed: 0 }
  }

  const jobs = await db
    .select()
    .from(externalCalendarSyncJobs)
    .where(and(
      eq(externalCalendarSyncJobs.connectionId, connectionId),
      inArray(externalCalendarSyncJobs.status, ['pending', 'error'])
    ))
    .limit(limit)
  const adapter = getExternalProvider(connection.provider)
  let processed = 0
  let failed = 0

  for (const job of jobs) {
    if (job.attempts >= 5) {
      continue
    }

    await db
      .update(externalCalendarSyncJobs)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(externalCalendarSyncJobs.id, job.id))

    try {
      const payload = job.payload as {
        externalId?: string | null
        event?: ExternalEventPayload & { startAt: string; endAt: string }
      }
      const eventPayload = normalizeJobEventPayload(payload.event)
      let externalId = payload.externalId ?? null
      let externalUpdatedAt: Date | null = null

      if (job.operation === 'delete') {
        if (externalId) {
          await adapter.deleteEvent(connection, externalId)
        }
      } else if (job.operation === 'create' || !externalId) {
        if (!eventPayload) {
          throw new Error('Missing event payload for external calendar create.')
        }
        const result = await adapter.createEvent(connection, eventPayload)
        externalId = result.externalId
        externalUpdatedAt = result.externalUpdatedAt
      } else {
        if (!eventPayload) {
          throw new Error('Missing event payload for external calendar update.')
        }
        const result = await adapter.updateEvent(connection, externalId, eventPayload)
        externalUpdatedAt = result.externalUpdatedAt
      }

      await db
        .update(externalCalendarSyncJobs)
        .set({ status: 'done', error: null, updatedAt: new Date() })
        .where(eq(externalCalendarSyncJobs.id, job.id))

      if (job.eventId && job.operation !== 'delete') {
        await db
          .update(calendarEvents)
          .set({
            externalId,
            externalUpdatedAt,
            syncStatus: 'synced',
            syncError: null,
            updatedAt: new Date()
          })
          .where(eq(calendarEvents.id, job.eventId))
      }

      processed += 1
    } catch (error) {
      const message = getErrorMessage(error)
      await db
        .update(externalCalendarSyncJobs)
        .set({
          status: 'error',
          attempts: job.attempts + 1,
          error: message,
          updatedAt: new Date()
        })
        .where(eq(externalCalendarSyncJobs.id, job.id))

      if (job.eventId) {
        await db
          .update(calendarEvents)
          .set({ syncStatus: 'error', syncError: message, updatedAt: new Date() })
          .where(eq(calendarEvents.id, job.eventId))
      }

      failed += 1
    }
  }

  return { processed, failed }
}

export function buildExternalEventValuesForCalendar(
  connection: ConnectionRow | null,
  existingExternalId?: string | null
) {
  if (!connection) {
    return {
      source: 'life_app',
      externalConnectionId: null,
      externalCalendarId: null,
      externalId: null,
      externalUpdatedAt: null,
      syncStatus: 'synced' as const,
      syncError: null
    }
  }

  return {
    source: connection.provider,
    externalConnectionId: connection.id,
    externalCalendarId: connection.providerCalendarId,
    externalId: existingExternalId ?? null,
    externalUpdatedAt: null,
    syncStatus: 'pending' as const,
    syncError: null
  }
}

export function getSyncWindow() {
  const config = useRuntimeConfig().externalCalendar
  const pastDays = Number.isFinite(config?.syncPastDays) ? Number(config.syncPastDays) : 365
  const futureDays = Number.isFinite(config?.syncFutureDays) ? Number(config.syncFutureDays) : 365

  return {
    from: addDays(new Date(), -Math.max(1, pastDays)),
    to: addDays(new Date(), Math.max(30, futureDays))
  }
}

function buildSyncPayload(event: CalendarEventRow) {
  return {
    externalId: event.externalId,
    externalCalendarId: event.externalCalendarId,
    event: buildExternalEventPayload(event)
  }
}

function buildExternalEventPayload(event: Pick<CalendarEventRow,
  'title' | 'category' | 'startAt' | 'endAt' | 'isRecurring' | 'recurrenceRule'
>) {
  return {
    title: event.title,
    category: event.category,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    isRecurring: event.isRecurring,
    recurrenceRule: event.recurrenceRule
  }
}

function normalizeJobEventPayload(payload: (ExternalEventPayload & { startAt: string; endAt: string }) | undefined) {
  if (!payload) {
    return null
  }

  return {
    ...payload,
    startAt: new Date(payload.startAt),
    endAt: new Date(payload.endAt)
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)

  return next
}

function getErrorMessage(error: unknown) {
  const maybe = error as Error & { statusMessage?: string }

  return maybe.statusMessage || maybe.message || 'External calendar sync failed.'
}

export function decryptWebhookSecret(value: string | null) {
  return decryptExternalSecret(value)
}
