-- Migrazione manuale (non gestita da Drizzle): backfill dello stato delle
-- relazioni preesistenti. Prima dell'handshake una relazione era un grant
-- unilaterale gia attivo, quindi va considerata 'accepted'.
-- Applicata da Supabase dopo l'aggiunta della colonna status (pretty_proemial_gods).
update public.relationships
set status = 'accepted'
where status = 'pending';
