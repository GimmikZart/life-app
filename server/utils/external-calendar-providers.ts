import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { useDatabase } from '../database/client'
import {
  externalCalendarConnections,
  type ExternalCalendarProvider
} from '../database/schema'
import {
  decryptExternalSecret,
  encryptExternalSecret
} from './external-calendar-crypto'

export type ExternalEventPayload = {
  title: string
  category: string | null
  startAt: Date
  endAt: Date
  isRecurring: boolean
  recurrenceRule: string | null
}

export type RemoteCalendarEvent = {
  externalId: string
  externalCalendarId: string
  title: string
  startAt: Date
  endAt: Date
  isCancelled: boolean
  externalUpdatedAt: Date | null
}

type ConnectionRow = typeof externalCalendarConnections.$inferSelect

type ExternalProviderAdapter = {
  listEvents: (connection: ConnectionRow, from: Date, to: Date) => Promise<RemoteCalendarEvent[]>
  createEvent: (connection: ConnectionRow, payload: ExternalEventPayload) => Promise<{ externalId: string; externalUpdatedAt: Date | null }>
  updateEvent: (connection: ConnectionRow, externalId: string, payload: ExternalEventPayload) => Promise<{ externalUpdatedAt: Date | null }>
  deleteEvent: (connection: ConnectionRow, externalId: string) => Promise<void>
  setupWebhook: (connection: ConnectionRow) => Promise<void>
  stopWebhook: (connection: ConnectionRow) => Promise<void>
}

export function getExternalProvider(provider: ExternalCalendarProvider): ExternalProviderAdapter {
  if (provider === 'google') {
    return googleProvider
  }

  return microsoftProvider
}

export function providerDisplayName(provider: ExternalCalendarProvider) {
  return provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'
}

export function providerColor(provider: ExternalCalendarProvider) {
  return provider === 'google' ? '#1a73e8' : '#0078d4'
}

export const googleCalendarScopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email'
]

export const microsoftCalendarScopes = [
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite'
]

async function getGoogleApi() {
  return (await import('googleapis')).google
}

export async function getGoogleOAuthClient() {
  const config = useRuntimeConfig().googleCalendar

  if (!config?.clientId || !config.clientSecret || !config.redirectUri) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Google Calendar OAuth env vars are not configured.'
    })
  }

  const google = await getGoogleApi()

  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)
}

export function getMicrosoftOAuthAuthorizeUrl(state: string) {
  const config = useRuntimeConfig().microsoftGraph

  if (!config?.clientId || !config.clientSecret || !config.redirectUri) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Microsoft Graph OAuth env vars are not configured.'
    })
  }

  const tenantId = config.tenantId || 'common'
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: microsoftCalendarScopes.join(' '),
    state
  })

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeMicrosoftCode(code: string) {
  const config = useRuntimeConfig().microsoftGraph
  const tenantId = config.tenantId || 'common'
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    scope: microsoftCalendarScopes.join(' ')
  })

  const token = await microsoftTokenRequest(tenantId, body)
  const profile = await microsoftGraphFetch<{ mail?: string; userPrincipalName?: string }>(
    token.access_token,
    '/me'
  )

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    scope: token.scope,
    email: profile.mail || profile.userPrincipalName || null
  }
}

async function getFreshGoogleAccessToken(connection: ConnectionRow) {
  const accessToken = decryptExternalSecret(connection.accessTokenEncrypted)
  const refreshToken = decryptExternalSecret(connection.refreshTokenEncrypted)
  const expiresSoon = !connection.expiresAt || connection.expiresAt.getTime() < Date.now() + 60_000

  if (!expiresSoon && accessToken) {
    return accessToken
  }

  if (!refreshToken) {
    await markConnectionNeedsReauth(connection.id)
    throw createError({ statusCode: 401, statusMessage: 'Google Calendar must be reconnected.' })
  }

  const auth = await getGoogleOAuthClient()
  auth.setCredentials({ refresh_token: refreshToken })
  const refreshed = await auth.refreshAccessToken()
  const credentials = refreshed.credentials
  const nextAccessToken = credentials.access_token

  if (!nextAccessToken) {
    await markConnectionNeedsReauth(connection.id)
    throw createError({ statusCode: 401, statusMessage: 'Google Calendar token refresh failed.' })
  }

  await useDatabase()
    .update(externalCalendarConnections)
    .set({
      accessTokenEncrypted: encryptExternalSecret(nextAccessToken) as string,
      refreshTokenEncrypted: encryptExternalSecret(credentials.refresh_token || refreshToken),
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      status: 'connected',
      updatedAt: new Date()
    })
    .where(eq(externalCalendarConnections.id, connection.id))

  return nextAccessToken
}

async function getFreshMicrosoftAccessToken(connection: ConnectionRow) {
  const accessToken = decryptExternalSecret(connection.accessTokenEncrypted)
  const refreshToken = decryptExternalSecret(connection.refreshTokenEncrypted)
  const expiresSoon = !connection.expiresAt || connection.expiresAt.getTime() < Date.now() + 60_000

  if (!expiresSoon && accessToken) {
    return accessToken
  }

  if (!refreshToken) {
    await markConnectionNeedsReauth(connection.id)
    throw createError({ statusCode: 401, statusMessage: 'Outlook Calendar must be reconnected.' })
  }

  const config = useRuntimeConfig().microsoftGraph
  const tenantId = config.tenantId || 'common'
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: config.redirectUri,
    scope: microsoftCalendarScopes.join(' ')
  })
  const token = await microsoftTokenRequest(tenantId, body)

  await useDatabase()
    .update(externalCalendarConnections)
    .set({
      accessTokenEncrypted: encryptExternalSecret(token.access_token) as string,
      refreshTokenEncrypted: encryptExternalSecret(token.refresh_token || refreshToken),
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      status: 'connected',
      updatedAt: new Date()
    })
    .where(eq(externalCalendarConnections.id, connection.id))

  return token.access_token
}

async function markConnectionNeedsReauth(connectionId: string) {
  await useDatabase()
    .update(externalCalendarConnections)
    .set({ status: 'needs_reauth', updatedAt: new Date() })
    .where(eq(externalCalendarConnections.id, connectionId))
}

const googleProvider: ExternalProviderAdapter = {
  async listEvents(connection, from, to) {
    const google = await getGoogleApi()
    const auth = await getGoogleOAuthClient()
    auth.setCredentials({ access_token: await getFreshGoogleAccessToken(connection) })
    const calendar = google.calendar({ version: 'v3', auth })
    const events: RemoteCalendarEvent[] = []
    let pageToken: string | undefined

    do {
      const response = await calendar.events.list({
        calendarId: connection.providerCalendarId || 'primary',
        maxResults: 2500,
        pageToken,
        showDeleted: true,
        singleEvents: true,
        timeMax: to.toISOString(),
        timeMin: from.toISOString(),
        timeZone: 'UTC'
      })

      for (const item of response.data.items ?? []) {
        if (!item.id) {
          continue
        }

        const startAt = parseGoogleEventDate(item.start)
        const endAt = parseGoogleEventDate(item.end)

        if (!startAt || !endAt) {
          continue
        }

        events.push({
          externalId: item.id,
          externalCalendarId: connection.providerCalendarId || 'primary',
          title: item.summary || '(Senza titolo)',
          startAt,
          endAt,
          isCancelled: item.status === 'cancelled',
          externalUpdatedAt: item.updated ? new Date(item.updated) : null
        })
      }

      pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)

    return events
  },

  async createEvent(connection, payload) {
    const google = await getGoogleApi()
    const auth = await getGoogleOAuthClient()
    auth.setCredentials({ access_token: await getFreshGoogleAccessToken(connection) })
    const calendar = google.calendar({ version: 'v3', auth })
    const response = await calendar.events.insert({
      calendarId: connection.providerCalendarId || 'primary',
      requestBody: toGoogleEvent(payload)
    })

    if (!response.data.id) {
      throw new Error('Google Calendar did not return an event id.')
    }

    return {
      externalId: response.data.id,
      externalUpdatedAt: response.data.updated ? new Date(response.data.updated) : null
    }
  },

  async updateEvent(connection, externalId, payload) {
    const google = await getGoogleApi()
    const auth = await getGoogleOAuthClient()
    auth.setCredentials({ access_token: await getFreshGoogleAccessToken(connection) })
    const calendar = google.calendar({ version: 'v3', auth })
    const response = await calendar.events.update({
      calendarId: connection.providerCalendarId || 'primary',
      eventId: externalId,
      requestBody: toGoogleEvent(payload)
    })

    return {
      externalUpdatedAt: response.data.updated ? new Date(response.data.updated) : null
    }
  },

  async deleteEvent(connection, externalId) {
    const google = await getGoogleApi()
    const auth = await getGoogleOAuthClient()
    auth.setCredentials({ access_token: await getFreshGoogleAccessToken(connection) })
    const calendar = google.calendar({ version: 'v3', auth })

    try {
      await calendar.events.delete({
        calendarId: connection.providerCalendarId || 'primary',
        eventId: externalId
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return
      }

      throw error
    }
  },

  async setupWebhook(connection) {
    const webhookBaseUrl = useRuntimeConfig().externalCalendar?.webhookBaseUrl

    if (!webhookBaseUrl || !webhookBaseUrl.startsWith('https://')) {
      return
    }

    if (connection.webhookExpiresAt && connection.webhookExpiresAt.getTime() > Date.now() + 12 * 60 * 60 * 1000) {
      return
    }

    const google = await getGoogleApi()
    const auth = await getGoogleOAuthClient()
    auth.setCredentials({ access_token: await getFreshGoogleAccessToken(connection) })
    const calendar = google.calendar({ version: 'v3', auth })
    const channelId = randomUUID()
    const channelSecret = randomUUID()
    const response = await calendar.events.watch({
      calendarId: connection.providerCalendarId || 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/google-calendar`,
        token: channelSecret
      }
    })

    await useDatabase()
      .update(externalCalendarConnections)
      .set({
        webhookChannelId: channelId,
        webhookResourceId: response.data.resourceId ?? null,
        webhookSecretEncrypted: encryptExternalSecret(channelSecret),
        webhookExpiresAt: response.data.expiration ? new Date(Number(response.data.expiration)) : null,
        updatedAt: new Date()
      })
      .where(eq(externalCalendarConnections.id, connection.id))
  },

  async stopWebhook(connection) {
    if (!connection.webhookChannelId || !connection.webhookResourceId) {
      return
    }

    const google = await getGoogleApi()
    const auth = await getGoogleOAuthClient()
    auth.setCredentials({ access_token: await getFreshGoogleAccessToken(connection) })
    const calendar = google.calendar({ version: 'v3', auth })

    try {
      await calendar.channels.stop({
        requestBody: {
          id: connection.webhookChannelId,
          resourceId: connection.webhookResourceId
        }
      })
    } catch {
      // If the provider already expired/removed the channel, local disconnect can continue.
    }
  }
}

const microsoftProvider: ExternalProviderAdapter = {
  async listEvents(connection, from, to) {
    const params = new URLSearchParams({
      startDateTime: from.toISOString(),
      endDateTime: to.toISOString(),
      '$top': '100'
    })
    const events: RemoteCalendarEvent[] = []
    let nextUrl: string | null = `/me/calendarView?${params}`

    while (nextUrl) {
      const response = await graphRequest<{
        value?: MicrosoftEvent[]
        '@odata.nextLink'?: string
      }>(connection, nextUrl)

      for (const item of response.value ?? []) {
        const startAt = parseMicrosoftDate(item.start)
        const endAt = parseMicrosoftDate(item.end)

        if (!item.id || !startAt || !endAt) {
          continue
        }

        events.push({
          externalId: item.id,
          externalCalendarId: connection.providerCalendarId || 'primary',
          title: item.subject || '(Senza titolo)',
          startAt,
          endAt,
          isCancelled: Boolean(item.isCancelled),
          externalUpdatedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null
        })
      }

      nextUrl = response['@odata.nextLink'] ?? null
    }

    return events
  },

  async createEvent(connection, payload) {
    const response = await graphRequest<MicrosoftEvent>(connection, '/me/events', {
      method: 'POST',
      body: JSON.stringify(toMicrosoftEvent(payload))
    })

    if (!response.id) {
      throw new Error('Microsoft Graph did not return an event id.')
    }

    return {
      externalId: response.id,
      externalUpdatedAt: response.lastModifiedDateTime ? new Date(response.lastModifiedDateTime) : null
    }
  },

  async updateEvent(connection, externalId, payload) {
    const response = await graphRequest<MicrosoftEvent>(connection, `/me/events/${encodeURIComponent(externalId)}`, {
      method: 'PATCH',
      body: JSON.stringify(toMicrosoftEvent(payload))
    })

    return {
      externalUpdatedAt: response.lastModifiedDateTime ? new Date(response.lastModifiedDateTime) : null
    }
  },

  async deleteEvent(connection, externalId) {
    try {
      await graphRequest(connection, `/me/events/${encodeURIComponent(externalId)}`, { method: 'DELETE' })
    } catch (error) {
      if (isNotFoundError(error)) {
        return
      }

      throw error
    }
  },

  async setupWebhook(connection) {
    const webhookBaseUrl = useRuntimeConfig().externalCalendar?.webhookBaseUrl

    if (!webhookBaseUrl || !webhookBaseUrl.startsWith('https://')) {
      return
    }

    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const secret = connection.webhookSecretEncrypted
      ? decryptExternalSecret(connection.webhookSecretEncrypted) || randomUUID()
      : randomUUID()

    if (connection.webhookSubscriptionId && connection.webhookExpiresAt && connection.webhookExpiresAt.getTime() > Date.now() + 12 * 60 * 60 * 1000) {
      return
    }

    if (connection.webhookSubscriptionId) {
      try {
        await graphRequest(connection, `/subscriptions/${connection.webhookSubscriptionId}`, {
          method: 'PATCH',
          body: JSON.stringify({ expirationDateTime: expiresAt.toISOString() })
        })

        await useDatabase()
          .update(externalCalendarConnections)
          .set({ webhookExpiresAt: expiresAt, updatedAt: new Date() })
          .where(eq(externalCalendarConnections.id, connection.id))

        return
      } catch {
        // Fall through and create a fresh subscription.
      }
    }

    const response = await graphRequest<{ id?: string; expirationDateTime?: string }>(connection, '/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        changeType: 'created,updated,deleted',
        notificationUrl: `${webhookBaseUrl.replace(/\/$/, '')}/api/webhooks/microsoft-calendar`,
        resource: 'me/events',
        expirationDateTime: expiresAt.toISOString(),
        clientState: secret
      })
    })

    await useDatabase()
      .update(externalCalendarConnections)
      .set({
        webhookSubscriptionId: response.id ?? null,
        webhookSecretEncrypted: encryptExternalSecret(secret),
        webhookExpiresAt: response.expirationDateTime ? new Date(response.expirationDateTime) : expiresAt,
        updatedAt: new Date()
      })
      .where(eq(externalCalendarConnections.id, connection.id))
  },

  async stopWebhook(connection) {
    if (!connection.webhookSubscriptionId) {
      return
    }

    try {
      await graphRequest(connection, `/subscriptions/${connection.webhookSubscriptionId}`, { method: 'DELETE' })
    } catch {
      // If Graph already removed the subscription, local disconnect can continue.
    }
  }
}

function parseGoogleEventDate(value: { date?: string | null; dateTime?: string | null } | null | undefined) {
  if (!value) {
    return null
  }

  const raw = value.dateTime || (value.date ? `${value.date}T00:00:00Z` : null)
  const date = raw ? new Date(raw) : null

  return date && !Number.isNaN(date.getTime()) ? date : null
}

function toGoogleEvent(payload: ExternalEventPayload) {
  return {
    summary: payload.title,
    start: { dateTime: payload.startAt.toISOString(), timeZone: 'UTC' },
    end: { dateTime: payload.endAt.toISOString(), timeZone: 'UTC' },
    recurrence: payload.isRecurring && payload.recurrenceRule
      ? [`RRULE:${payload.recurrenceRule}`]
      : undefined
  }
}

type MicrosoftEvent = {
  id?: string
  subject?: string
  start?: { dateTime?: string; timeZone?: string }
  end?: { dateTime?: string; timeZone?: string }
  isCancelled?: boolean
  lastModifiedDateTime?: string
}

function parseMicrosoftDate(value: { dateTime?: string; timeZone?: string } | null | undefined) {
  if (!value?.dateTime) {
    return null
  }

  const raw = value.dateTime.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value.dateTime)
    ? value.dateTime
    : `${value.dateTime}Z`
  const date = new Date(raw)

  return Number.isNaN(date.getTime()) ? null : date
}

function toMicrosoftEvent(payload: ExternalEventPayload) {
  const event: Record<string, unknown> = {
    subject: payload.title,
    start: { dateTime: toGraphDateTime(payload.startAt), timeZone: 'UTC' },
    end: { dateTime: toGraphDateTime(payload.endAt), timeZone: 'UTC' }
  }
  const recurrence = payload.isRecurring && payload.recurrenceRule
    ? toMicrosoftRecurrence(payload.recurrenceRule, payload.startAt)
    : null

  if (recurrence) {
    event.recurrence = recurrence
  }

  return event
}

function toGraphDateTime(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '')
}

function toMicrosoftRecurrence(rule: string, startAt: Date) {
  const parts = Object.fromEntries(
    rule.split(';').map((part) => {
      const [key, value] = part.split('=')

      return [key?.toUpperCase(), value]
    })
  ) as Record<string, string | undefined>
  const frequency = parts.FREQ
  const interval = Number(parts.INTERVAL ?? 1)
  const startDate = startAt.toISOString().slice(0, 10)
  const range: Record<string, unknown> = {
    type: 'noEnd',
    startDate
  }

  if (parts.UNTIL?.length) {
    range.type = 'endDate'
    range.endDate = `${parts.UNTIL.slice(0, 4)}-${parts.UNTIL.slice(4, 6)}-${parts.UNTIL.slice(6, 8)}`
  }

  if (frequency === 'DAILY') {
    return { pattern: { type: 'daily', interval }, range }
  }

  if (frequency === 'WEEKLY') {
    return {
      pattern: {
        type: 'weekly',
        interval,
        daysOfWeek: [microsoftDayName(startAt)]
      },
      range
    }
  }

  if (frequency === 'MONTHLY') {
    return {
      pattern: {
        type: 'absoluteMonthly',
        interval,
        dayOfMonth: startAt.getUTCDate()
      },
      range
    }
  }

  if (frequency === 'YEARLY') {
    return {
      pattern: {
        type: 'absoluteYearly',
        interval,
        dayOfMonth: startAt.getUTCDate(),
        month: startAt.getUTCMonth() + 1
      },
      range
    }
  }

  return null
}

function microsoftDayName(date: Date) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getUTCDay()]
}

async function graphRequest<T = unknown>(
  connection: ConnectionRow,
  pathOrUrl: string,
  init: RequestInit = {}
) {
  const token = await getFreshMicrosoftAccessToken(connection)
  const url = pathOrUrl.startsWith('https://')
    ? pathOrUrl
    : `https://graph.microsoft.com/v1.0${pathOrUrl}`
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'outlook.timezone="UTC"',
      ...(init.headers ?? {})
    }
  })

  if (response.status === 204) {
    return {} as T
  }

  const text = await response.text()
  const body = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message = body?.error?.message || response.statusText
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }

  return body as T
}

async function microsoftGraphFetch<T>(accessToken: string, path: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const body = await response.json()

  if (!response.ok) {
    throw new Error(body?.error?.message || response.statusText)
  }

  return body as T
}

async function microsoftTokenRequest(tenantId: string, body: URLSearchParams) {
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const token = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    error_description?: string
  }

  if (!response.ok || !token.access_token) {
    throw createError({
      statusCode: 400,
      statusMessage: token.error_description || 'Microsoft OAuth token exchange failed.'
    })
  }

  return token as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
}

function isNotFoundError(error: unknown) {
  const maybe = error as { code?: number; status?: number; statusCode?: number }

  return maybe.code === 404 || maybe.status === 404 || maybe.statusCode === 404 || maybe.code === 410
}
