import { useDatabase } from '../../database/client'
import { users } from '../../database/schema'

export default defineEventHandler(async () => {
  const db = useDatabase()
  const result = await db.select({ id: users.id }).from(users).limit(1)

  return {
    ok: true,
    usersTableReachable: true,
    sampleSize: result.length
  }
})
