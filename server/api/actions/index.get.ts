import { desc, eq } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { actions } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()

  const rows = await db
    .select()
    .from(actions)
    .where(eq(actions.userId, currentUser.id))
    .orderBy(desc(actions.createdAt))

  return { actions: rows }
})
