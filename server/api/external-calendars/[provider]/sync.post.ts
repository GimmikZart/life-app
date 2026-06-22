import { requireAuthenticatedUser } from '../../../utils/auth'
import {
  parseExternalProvider,
  syncExternalCalendarConnection
} from '../../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const provider = parseExternalProvider(getRouterParam(event, 'provider'))
  const result = await syncExternalCalendarConnection(currentUser.id, provider)

  return { ok: true, ...result }
})
