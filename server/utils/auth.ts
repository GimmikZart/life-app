import { serverSupabaseUser } from '#supabase/server'

export async function requireAuthenticatedUser(event: Parameters<typeof serverSupabaseUser>[0]) {
  const claims = await serverSupabaseUser(event).catch(() => null)
  const tokenUser = claims?.sub
    ? null
    : await getUserFromBearerToken(event)
  const userId = claims?.sub ?? tokenUser?.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required.'
    })
  }

  return {
    id: userId,
    email: typeof claims?.email === 'string' ? claims.email : tokenUser?.email ?? null
  }
}

async function getUserFromBearerToken(event: Parameters<typeof serverSupabaseUser>[0]) {
  const authorization = getHeader(event, 'authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null

  if (!token) {
    return null
  }

  const config = useRuntimeConfig(event)
  const response = await fetch(`${config.public.supabase.url}/auth/v1/user`, {
    headers: {
      apikey: config.public.supabase.key,
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json() as { id?: string; email?: string }

  return payload.id ? { id: payload.id, email: payload.email ?? null } : null
}
