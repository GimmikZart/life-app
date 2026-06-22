import { requireAuthenticatedUser } from '../../utils/auth'
import { listExternalCalendarConnections } from '../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const connections = await listExternalCalendarConnections(currentUser.id)

  return {
    connections: connections.map((connection) => ({
      ...connection,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      webhookExpiresAt: connection.webhookExpiresAt?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString()
    }))
  }
})
