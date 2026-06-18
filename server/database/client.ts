import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

let database: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDatabase() {
  if (!database) {
    const databaseUrl = useRuntimeConfig().databaseUrl

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
    }

    const client = postgres(databaseUrl, {
      max: 1,
      prepare: false
    })

    database = drizzle(client, { schema })
  }

  return database
}
