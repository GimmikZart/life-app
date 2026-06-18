import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  migrations: {
    prefix: 'supabase'
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  }
})
