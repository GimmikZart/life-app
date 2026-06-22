import { inArray } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { externalCalendarConnections } from '../../database/schema'
import {
  decryptWebhookSecret,
  syncExternalCalendarConnectionById
} from '../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  if (typeof query.validationToken === 'string') {
    setHeader(event, 'Content-Type', 'text/plain')

    return query.validationToken
  }

  const body = await readBody<{ value?: Array<{ subscriptionId?: string; clientState?: string }> }>(event)
  const notifications = body.value ?? []
  const subscriptionIds = notifications
    .map((notification) => notification.subscriptionId)
    .filter((value): value is string => Boolean(value))

  if (!subscriptionIds.length) {
    return { ok: true }
  }

  const connections = await useDatabase()
    .select()
    .from(externalCalendarConnections)
    .where(inArray(externalCalendarConnections.webhookSubscriptionId, subscriptionIds))
  const connectionBySubscription = new Map(
    connections
      .filter((connection) => connection.webhookSubscriptionId)
      .map((connection) => [connection.webhookSubscriptionId as string, connection])
  )
  const syncedConnectionIds = new Set<string>()

  for (const notification of notifications) {
    if (!notification.subscriptionId) {
      continue
    }

    const connection = connectionBySubscription.get(notification.subscriptionId)

    if (!connection) {
      continue
    }

    const expectedSecret = decryptWebhookSecret(connection.webhookSecretEncrypted)

    if (expectedSecret && notification.clientState !== expectedSecret) {
      continue
    }

    syncedConnectionIds.add(connection.id)
  }

  for (const connectionId of syncedConnectionIds) {
    await syncExternalCalendarConnectionById(connectionId)
  }

  return { ok: true }
})
