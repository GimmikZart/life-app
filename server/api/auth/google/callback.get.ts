import { requireAuthenticatedUser } from '../../../utils/auth'
import { verifyExternalCalendarState } from '../../../utils/external-calendar-crypto'
import { getGoogleOAuthClient } from '../../../utils/external-calendar-providers'
import {
  syncExternalCalendarConnection,
  upsertExternalCalendarConnection
} from '../../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = verifyExternalCalendarState<{ provider?: string; userId?: string }>(
    typeof query.state === 'string' ? query.state : undefined
  )

  if (state.provider !== 'google' || state.userId !== currentUser.id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Google OAuth callback state.' })
  }

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Google OAuth code.' })
  }

  try {
    const auth = await getGoogleOAuthClient()
    const { tokens } = await auth.getToken(code)

    if (!tokens.access_token) {
      throw new Error('Google did not return an access token.')
    }

    auth.setCredentials(tokens)

    let email: string | null = null
    try {
      const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth })
      const profile = await oauth2.userinfo.get()
      email = profile.data.email ?? null
    } catch {
      email = null
    }

    await upsertExternalCalendarConnection({
      userId: currentUser.id,
      provider: 'google',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? null,
      providerAccountEmail: email
    })
    await syncExternalCalendarConnection(currentUser.id, 'google')

    return sendRedirect(event, '/calendar/integrations?connected=google')
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : 'Google connection failed.')

    return sendRedirect(event, `/calendar/integrations?error=${message}`)
  }
})
