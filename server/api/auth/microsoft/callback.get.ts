import { requireAuthenticatedUser } from '../../../utils/auth'
import { verifyExternalCalendarState } from '../../../utils/external-calendar-crypto'
import { exchangeMicrosoftCode } from '../../../utils/external-calendar-providers'
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

  if (state.provider !== 'microsoft' || state.userId !== currentUser.id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Microsoft OAuth callback state.' })
  }

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Microsoft OAuth code.' })
  }

  try {
    const tokens = await exchangeMicrosoftCode(code)

    await upsertExternalCalendarConnection({
      userId: currentUser.id,
      provider: 'microsoft',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope ?? null,
      providerAccountEmail: tokens.email
    })
    await syncExternalCalendarConnection(currentUser.id, 'microsoft')

    return sendRedirect(event, '/calendar/integrations?connected=microsoft')
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : 'Microsoft connection failed.')

    return sendRedirect(event, `/calendar/integrations?error=${message}`)
  }
})
