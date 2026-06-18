# Supabase local backend

This folder is kept in version control so local Supabase work stays reproducible.

## Contents

- `config.toml` - local Supabase configuration.
- `migrations/` - SQL migrations tracked in git.
- `seed.sql` - local seed data, if needed.

## Working locally

1. Start Supabase locally with `npm run supabase:start`.
2. Use Drizzle to generate migration SQL into `supabase/migrations/`.
3. Apply migrations with `npm run db:migrate` or `supabase db reset`.

## Notes

- Keep `DATABASE_URL` pointed at the local Postgres endpoint while developing
  against the local backend.
- Commit every meaningful schema change to `supabase/migrations/` so the backend
  state can be reproduced from source control.
