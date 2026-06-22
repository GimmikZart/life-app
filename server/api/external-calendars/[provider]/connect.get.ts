import { requireAuthenticatedUser } from '../../../utils/auth'
import { signExternalCalendarState } from '../../../utils/external-calendar-crypto'
import {
  getGoogleOAuthClient,
  getMicrosoftOAuthAuthorizeUrl,
  googleCalendarScopes
} from '../../../utils/external-calendar-providers'
import { parseExternalProvider } from '../../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const provider = parseExternalProvider(getRouterParam(event, 'provider'))
  const state = signExternalCalendarState({ provider, userId: currentUser.id })

  if (provider === 'google') {
    const auth = await getGoogleOAuthClient()
    const redirectUrl = auth.generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      prompt: 'consent',
      scope: googleCalendarScopes,
      state
    })

    return sendRedirect(event, redirectUrl)
  }

  return sendRedirect(event, getMicrosoftOAuthAuthorizeUrl(state))
})
