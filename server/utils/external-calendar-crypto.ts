import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto'

const algorithm = 'aes-256-gcm'

function getTokenKey() {
  const secret = useRuntimeConfig().externalCalendar?.tokenSecret

  if (!secret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'EXTERNAL_CALENDAR_TOKEN_SECRET is required before connecting external calendars.'
    })
  }

  return createHash('sha256').update(secret).digest()
}

export function encryptExternalSecret(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, getTokenKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join(':')
}

export function decryptExternalSecret(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const [version, ivValue, tagValue, encryptedValue] = value.split(':')

  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw createError({ statusCode: 500, statusMessage: 'Invalid encrypted calendar token.' })
  }

  const decipher = createDecipheriv(algorithm, getTokenKey(), Buffer.from(ivValue, 'base64'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final()
  ]).toString('utf8')
}

export function signExternalCalendarState(payload: Record<string, unknown>) {
  const data = Buffer
    .from(JSON.stringify({ ...payload, issuedAt: Date.now() }), 'utf8')
    .toString('base64url')
  const signature = createHmac('sha256', getTokenKey()).update(data).digest('base64url')

  return `${data}.${signature}`
}

export function verifyExternalCalendarState<T extends Record<string, unknown>>(state: string | undefined): T {
  if (!state) {
    throw createError({ statusCode: 400, statusMessage: 'Missing OAuth state.' })
  }

  const [data, signature] = state.split('.')

  if (!data || !signature) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state.' })
  }

  const expected = createHmac('sha256', getTokenKey()).update(data).digest('base64url')
  const received = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state signature.' })
  }

  const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T & { issuedAt?: number }
  const issuedAt = typeof parsed.issuedAt === 'number' ? parsed.issuedAt : 0

  if (Date.now() - issuedAt > 15 * 60 * 1000) {
    throw createError({ statusCode: 400, statusMessage: 'OAuth state expired.' })
  }

  return parsed
}
