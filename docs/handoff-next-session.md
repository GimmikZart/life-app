# Handoff — Stato del progetto e prossimo step (aggiornato 2026-06-22)

> Documento per riprendere il lavoro in una chat nuova con contesto fresco, senza perdere pezzi.
> Da leggere insieme a: `docs/life-app-project-knowledge_v2.md` (panoramica prodotto), `docs/action-plan/00-piano-di-sviluppo-indice.md` (piano) e i singoli cicli in `docs/action-plan/`.
> Esiste una memoria persistente dell'assistente con i dettagli di design: i file in `…/memory/` (in particolare `calendar-feature-design.md`).

## Cos'è Life App
PWA "sistema operativo personale" (calendario + abitudini/azioni + obiettivi/skill con gamification + proprietà + finanze future). Sviluppo a **cicli/sotto-cicli** (un sotto-ciclo ≈ una sessione). Si lavora **alternando questo assistente e Codex** sullo stesso repo → a inizio sessione controllare SEMPRE `git status`/`git log`, il working tree può essere cambiato dall'altro.

## Stack & ambiente locale (IMPORTANTE)
- **Nuxt 4 / Vue 3**, **Supabase (Postgres) + Drizzle ORM**, **FullCalendar** (daygrid/timegrid/multimonth/list/interaction), `rrule`, integrazioni `googleapis` + `@microsoft/microsoft-graph-client`/`@azure/msal-node`.
- **Porte Supabase locali = `5332x`** (NON le default `5432x`, occupate da un altro progetto "BACKEND" dell'utente; e NON `5532x`, finite in un range riservato da Windows/WinNAT). DB URL: `postgresql://postgres:postgres@127.0.0.1:53322/postgres`. Configurate in `supabase/config.toml` + `.env` + `.env.example` + README.
  - Se dopo un riavvio di Docker una porta non si bind: `supabase stop && supabase start`. Se l'errore è "bind: forbidden" controllare `netsh interface ipv4 show excludedportrange protocol=tcp` (range riservati Windows) e spostare le porte fuori da quei range.
- **Migrazioni**: lo schema Drizzle è in `server/database/schema/*` (export da `server/database/schema.ts`). Genera con `npm run db:generate`; applica con **`supabase migration up --local`** (NON `npm run db:migrate`: le migrazioni "a mano" come trigger/backfill non sono nel journal Drizzle ma vengono applicate da Supabase in ordine di timestamp). Se una migrazione risulta già applicata al DB ma non in history: `supabase migration repair --status applied <version> --local`.
- **Comandi di verifica** (eseguirli sempre a fine modifica): `npx nuxi typecheck` (deve dare exit 0) e `npm run build` (exit 0). NB: `build` transpila ma NON typecheck-a → usare ENTRAMBI.
- **Dev server**: gira già; per riavviarlo dopo modifiche strutturali (nuove pagine/rotte, nuovi plugin, dopo un `build` che tocca `.nuxt`): killare il processo sulla porta 3000/3001 e `NUXT_IGNORE_LOCK=1 npm run dev`. Auth via middleware globale: rotte non pubbliche → 302 a `/login` se non loggato; API → 401. (Quindi in smoke test 302/401 = "rotta OK", 500 = errore.)
- **Convenzione utente (`AGENTS.md`)**: mobile-first; centralizzare in componenti riusabili; a fine task eseguire:
  `powershell -NoProfile -Command "(New-Object System.Media.SoundPlayer 'C:\Users\gm.115\Desktop\agent_sound.wav').PlaySync()"`
- L'assistente NON può fare il click-through autenticato (niente password): la verifica funzionale finale la fa l'utente. Molte feature (condivisione, relazioni, room, sync) richiedono 2+ account.

## Pitfall tecnici già incontrati (evitarli)
- **Routing Nuxt**: se esiste `pages/x.vue` E la cartella `pages/x/`, `x.vue` diventa layout padre e serve `<NuxtPage/>`. Usare invece `pages/x/index.vue`. (Già sistemato per /calendar.)
- **Typed `$fetch` di Nitro**: su una rotta con più metodi (es. esiste sia `[id].get.ts` sia `[id].patch.ts`), passare `method:'DELETE'/'PATCH'` può dare errore TS "method not assignable". Workaround: castare l'URL `as string`.
- **Drizzle**: `const [x] = await db…returning()` / `.limit(1)` → `x` è `T | undefined`. Mettere SEMPRE una guardia (`if (!x) throw createError({statusCode:500,…})`) prima di accedere a `x.id`, altrimenti typecheck rosso + rischio crash.
- Linter dell'utente a volte riformatta i file (es. h2→h3): ricontrollare il template dopo.

## STATO: cosa è FATTO
**Ciclo 1 (Setup)** ✅ e **Ciclo 2 (Calendario)** ✅ COMPLETO, incluso:
- Schema completo (calendars, calendar_members con status/is_primary/auto_integrate, calendar_events con category/visibility/source/external_id/action_id, relationships con status, event_visibility_overrides, event_associations, event_official_pins, rooms, room_participants, event_exceptions, external_calendar_connections, external_calendar_sync_jobs). RLS sulle tabelle CORE c'è.
- **Modello a "layer"**: calendario primario per utente (auto-creato alla registrazione), `auto_integrate` per-membro, **pin per-utente** (`event_official_pins`) per integrare manualmente nella propria "vista ufficiale" qualsiasi evento visibile. Scope eventi GET: `mine`/`official`/`all` + filtro `calendarIds`.
- **CRUD** calendari/eventi; **ricorrenze RRULE** con UI a select (giorno/sett/mese/anno/personalizzato + fine) e **eccezioni complete** (`?scope=all|single|following&occurrence=` su PATCH/DELETE, tabella `event_exceptions`, util `recurrence-scope.ts`, UI "Applica a: Solo questo / Questo e successivi / Tutta la serie").
- **Condivisione**: membri (invito per email, accept/decline) **+ link pubblico** (`calendars.share_token`, join via `/calendar/join/[token]`).
- **Connessioni reciproche** (`relationships` con handshake pending/accepted/declined, riga reciproca all'accept) + **privacy** (default `busy`, `resolveEventVisibility` applica solo relazioni accettate, override per-evento).
- **Confronto disponibilità** (`/api/availability`, vista `/calendar/availability`) + **Room effimere** (`/calendar/rooms`, token, scadenza, `/api/rooms/*`) con algoritmo slot liberi (`useFreeSlots`).
- **Eventi-contatto** (associazione a un contatto con colore/icona — 2.6).
- **Refactor UX** (reference mobile dark): toolbar sticky con data + frecce + toggle 5 viste (Anno/Mese/Settimana/Giorno/Eventi) + select calendario + icone Cerca/Filtra; **FAB** (Crea evento + Vai a oggi); swipe avanti/indietro (mobile); orari 00–24; in vista Mese click su giorno = cella cerchiata + lista eventi sotto, click su evento = overlay (info + Apri/Modifica + Sposta/Aggiungi al principale); Cerca per titolo (`/api/calendar-events/search`); Filtra = pannello multi-calendario. Menu header a 3 voci (Confronta disponibilità / I miei calendari / Relazioni); logout solo in Today.

**Ciclo 6 (Integrazioni esterne Google/Microsoft)** ✅ fatto da Codex FUORI ORDINE (sync bidirezionale, OAuth callback, webhook, coda `external_calendar_sync_jobs`, crittografia token). All'ultimo controllo: typecheck+build verdi, migrazione riparata in history.

## STATO: DEBITI / cose aperte (non bloccanti, NESSUNA decisione utente in sospeso)
1. **Zero test**: manca un test runner; i criteri del piano chiedono test minimi, soprattutto unit su `resolveEventVisibility` (server/utils/event-visibility.ts), free-slot (app/composables/useFreeSlots.ts) ed espansione ricorrenze (server/utils/calendar-recurrence.ts).
2. **RLS mancanti** sulle tabelle nuove: event_official_pins, rooms, room_participants, event_exceptions, external_calendar_connections, external_calendar_sync_jobs (le core ce l'hanno). L'autorizzazione vera è già a livello applicativo (il server usa Drizzle come superuser → bypassa comunque RLS), quindi è coerenza/difesa-in-profondità.
3. **Sync esterna da collaudare**: serve riempire `.env` con credenziali OAuth reali (GOOGLE_CLIENT_ID/SECRET, MICROSOFT_*). Da confermare con Codex: **chi processa periodicamente** `external_calendar_sync_jobs` e **rinnova i webhook** (esiste `processExternalSyncJobs` ma serve un cron/scheduled trigger; altrimenti le modifiche locali restano `pending` fino al prossimo sync manuale).
4. Eventuale rifinitura estetica della griglia mese (fedeltà pixel alla reference) — opzionale.

## PROSSIMO STEP CONCORDATO: Ciclo 3 — Action Engine
Aprire `docs/action-plan/03-ciclo-action-engine.md` (sotto-cicli 3.1–3.4) + l'indice `00-…`. È il cuore del prodotto oltre il calendario e sblocca i Cicli 4 (Obiettivi+Skill) e 5 (Proprietà).
- Aggancio già predisposto: **`calendar_events.action_id`** esiste come colonna placeholder (nullable, SENZA foreign key attiva) proprio in attesa di questo ciclo. Il piano (changelog di revisione) prevede di attivarla come FK reale qui, più `action_completions` con `calendar_event_id` + `occurrence_date` e unique constraint per legare completamento ↔ occorrenza.
- Procedere un sotto-ciclo alla volta, rispettando lo schema del Project Knowledge v2; segnalare deviazioni invece di applicarle in sordina.

## Come ripartire (prima azione consigliata nella nuova chat)
1. `git status` + `git log --oneline -5` (allineamento con Codex).
2. Verificare ambiente: `supabase status` (DB su 53322) e che dev/typecheck/build siano verdi.
3. Leggere `docs/action-plan/03-ciclo-action-engine.md` e proporre all'utente il piano del **sotto-ciclo 3.1** prima di scrivere codice.
