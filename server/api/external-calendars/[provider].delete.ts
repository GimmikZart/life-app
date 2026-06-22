import { requireAuthenticatedUser } from '../../utils/auth'
import {
  deleteExternalCalendarConnection,
  parseExternalProvider
} from '../../utils/external-calendar-sync'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const provider = parseExternalProvider(getRouterParam(event, 'provider'))

  await deleteExternalCalendarConnection(currentUser.id, provider)

  return { ok: true }
})
