# Life App

PWA Nuxt 4 per un sistema operativo personale centrato su calendario condiviso, Action Engine, obiettivi, skill e proprieta.

## Stack

- Nuxt 4.3.1 + Vue 3
- Supabase/PostgreSQL
- Drizzle ORM
- FullCalendar Vue con supporto RRULE
- PWA via `@vite-pwa/nuxt`
- Google Calendar API e Microsoft Graph preparati come integrazioni future

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Local Supabase

The repository now includes a versioned `supabase/` folder for local backend work.

- `supabase/config.toml` keeps the local Supabase project settings in git.
- `supabase/migrations/` is the versioned migration folder used by Drizzle.
- `supabase/seed.sql` is reserved for local seed data.

Suggested local workflow:

```bash
npm run supabase:start
npm run db:generate
npm run db:migrate
```

If the Supabase CLI is not installed yet, install it first and then populate
`.env` from `supabase status`. Keep `DATABASE_URL` pointed at the local Postgres
instance while developing offline or against a local backend.

Life App uses the local port range `55321-55324` plus analytics on `55327` to
avoid collisions with other Supabase projects using the default ports.
