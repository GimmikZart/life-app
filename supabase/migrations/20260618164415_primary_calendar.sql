-- Migrazione manuale (non gestita da Drizzle): auto-creazione del calendario
-- primario "Personale" alla registrazione + backfill degli utenti esistenti.
-- Applicata da Supabase in ordine di timestamp, dopo l'aggiunta delle colonne
-- is_primary / auto_integrate (20260618164414_pale_storm).

-- 1. Estende il trigger di sync utente: ogni nuovo utente parte con un calendario
--    primario "Personale" gia integrato nella vista ufficiale.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_calendar_id uuid;
begin
  insert into public.users (id, email, name, avatar, preferences)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    '{}'::jsonb
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(excluded.name, public.users.name),
        avatar = coalesce(excluded.avatar, public.users.avatar);

  -- Idempotente: crea il primario solo se l'utente non ha ancora membership.
  if not exists (select 1 from public.calendar_members where user_id = new.id) then
    insert into public.calendars (user_id, name, color, type)
    values (new.id, 'Personale', '#2563eb', 'personal')
    returning id into new_calendar_id;

    insert into public.calendar_members (calendar_id, user_id, permission, status, is_primary, auto_integrate)
    values (new_calendar_id, new.id, 'owner', 'accepted', true, true);
  end if;

  return new;
end;
$$;

-- 2. Backfill: promuovi a primario una membership owner accettata per ogni
--    utente che ha gia calendari ma nessun primario.
with candidate as (
  select distinct on (cm.user_id) cm.calendar_id, cm.user_id
  from public.calendar_members cm
  where cm.permission = 'owner'
    and cm.status = 'accepted'
    and not exists (
      select 1 from public.calendar_members p
      where p.user_id = cm.user_id and p.is_primary = true
    )
  order by cm.user_id, cm.calendar_id
)
update public.calendar_members cm
set is_primary = true,
    auto_integrate = true
from candidate c
where cm.calendar_id = c.calendar_id
  and cm.user_id = c.user_id;

-- 3. Backfill: crea il primario "Personale" per gli utenti senza alcun calendario.
do $$
declare
  target_user record;
  new_calendar_id uuid;
begin
  for target_user in
    select usr.id
    from public.users usr
    where not exists (
      select 1 from public.calendar_members cm where cm.user_id = usr.id
    )
  loop
    insert into public.calendars (user_id, name, color, type)
    values (target_user.id, 'Personale', '#2563eb', 'personal')
    returning id into new_calendar_id;

    insert into public.calendar_members (calendar_id, user_id, permission, status, is_primary, auto_integrate)
    values (new_calendar_id, target_user.id, 'owner', 'accepted', true, true);
  end loop;
end $$;
