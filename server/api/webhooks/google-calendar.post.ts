import { and, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { externalCalendarConnections } from '../../database/schema'
import {
  decryptWebhookSecret,
  syncExternalCalendarConnectionById
} from '../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const channelId = getHeader(event, 'x-goog-channel-id')
  const resourceId = getHeader(event, 'x-goog-resource-id')
  const token = getHeader(event, 'x-goog-channel-token')

  if (!channelId || !resourceId || !token) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Google Calendar webhook.' })
  }

  const [connection] = await useDatabase()
    .select()
    .from(externalCalendarConnections)
    .where(and(
      eq(externalCalendarConnections.provider, 'google'),
      eq(externalCalendarConnections.webhookChannelId, channelId),
      eq(externalCalendarConnections.webhookResourceId, resourceId)
    ))
    .limit(1)

  if (!connection) {
    return { ok: true }
  }

  if (decryptWebhookSecret(connection.webhookSecretEncrypted) !== token) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid Google Calendar webhook token.' })
  }

  await syncExternalCalendarConnectionById(connection.id)

  return { ok: true }
})
