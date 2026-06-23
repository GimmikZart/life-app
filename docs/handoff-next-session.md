# Handoff — Stato del progetto e prossimo step (aggiornato 2026-06-23)

> Documento per riprendere il lavoro in una chat nuova con contesto fresco.
> Da leggere insieme a: `docs/life-app-project-knowledge_v2.md` (panoramica prodotto, **aggiornato** §3.2/§4), `docs/action-plan/00-piano-di-sviluppo-indice.md` (piano) e i singoli cicli in `docs/action-plan/`.

## Cos'è Life App
PWA "sistema operativo personale" (calendario + azioni + obiettivi/skill con gamification + proprietà + finanze future). Sviluppo a **cicli/sotto-cicli** (un sotto-ciclo ≈ una sessione). Si lavora **alternando questo assistente e Codex** sullo stesso repo → a inizio sessione controllare SEMPRE `git status`/`git log`, il working tree può essere cambiato dall'altro.

## ⚠️ Modello "Action" — CORRETTO (revisione 2026-06, leggere prima di toccare Ciclo 3/4)
**Non esistono Action come entità separata.** Un'Action è semplicemente un **evento del calendario** (e, in futuro, un **Todo**) a cui sono associati una o più **Skill** e/o **Obiettivi**. Quando l'evento viene **svolto** (resta a calendario e l'utente lo segna completato) → assegna punti alle Skill e fa avanzare gli Obiettivi. Gli eventi restano **eventi normali → sempre sincronizzabili con Google/Microsoft**, ricorrenza nativa inclusa.

- Un primo tentativo (Ciclo 3.1–3.4) aveva creato una tabella `actions` separata + un motore che generava eventi-copia: **revertato** (commit di revert sopra `2d17e8f`) perché duplicava la ricorrenza e rendeva gli eventi local-only.
- Le tabelle ponte/log si creano nei Cicli 4/5 e agganciano gli **eventi**: `event_objectives`, `event_skills` (con `contribution_weight`, `type`), `event_properties`, `event_completions` (`calendar_event_id` + `occurrence_date`, unique). Il peso 1/2/3 diventa un campo di `calendar_events`.
- Dettagli: `docs/action-plan/03-ciclo-action-engine.md` (riscritto) e PK v2 §3.2/§4.

## Stack & ambiente locale (IMPORTANTE)
- **Nuxt 4 / Vue 3**, **Supabase (Postgres) + Drizzle ORM**, **FullCalendar**, `rrule`, integrazioni `googleapis` + `@microsoft/microsoft-graph-client`/`@azure/msal-node`.
- **Porte Supabase locali = `5332x`** (NON le default `5432x`, né `5532x`). DB URL: `postgresql://postgres:postgres@127.0.0.1:53322/postgres`.
  - Se dopo un riavvio di Docker una porta non si bind: `supabase stop && supabase start`. Per "bind: forbidden" controllare `netsh interface ipv4 show excludedportrange protocol=tcp`.
  - `psql` non è nel PATH: usare `docker exec -i supabase_db_life-app psql -U postgres -d postgres`.
- **Migrazioni**: schema Drizzle in `server/database/schema/*` (export da `server/database/schema.ts`). Genera con `npm run db:generate`; applica con **`supabase migration up --local`** (NON `npm run db:migrate`). Le RLS e i constraint "a mano" si appendono al file di migrazione generato (pattern già usato). Repair: `supabase migration repair --status applied <version> --local`.
- **Comandi di verifica** (sempre a fine modifica): `npx nuxi typecheck` (exit 0) e `npm run build` (exit 0). `build` NON typecheck-a → usare ENTRAMBI. Nota: con `| tail` l'output esce solo a fine comando; redirigere su file per leggere live.
- **Dev server**: gira sulla 3000; auth via middleware globale (rotte non pubbliche → 302 a `/login`; API → 401). Quindi negli smoke test 302/401 = "rotta OK", 500 = errore.
- **Convenzione utente (`AGENTS.md`)**: mobile-first; centralizzare in componenti riusabili; a fine task eseguire:
  `powershell -NoProfile -Command "(New-Object System.Media.SoundPlayer 'C:\Users\gm.115\Desktop\agent_sound.wav').PlaySync()"`
- L'assistente NON può fare il click-through autenticato (niente password): la verifica funzionale finale la fa l'utente.

## Pitfall tecnici già incontrati
- **Import circolare tra file schema Drizzle**: se due tabelle si referenziano a vicenda (es. una FK A→B e una B→A), dichiarare una delle due FK solo nella migrazione SQL e tenere la colonna come `uuid` semplice nello schema TS, per evitare il ciclo di import.
- **Routing Nuxt**: se esiste `pages/x.vue` E la cartella `pages/x/`, usare `pages/x/index.vue`.
- **Typed `$fetch` su rotta con più metodi**: castare l'URL `as string` per evitare errori TS sul `method`.
- **Drizzle**: `const [x] = await db…returning()` → `x` è `T | undefined`: mettere SEMPRE una guardia prima di usarlo.
- Linter dell'utente a volte riformatta i file: ricontrollare il template dopo.

## STATO: cosa è FATTO
- **Ciclo 1 (Setup)** ✅ e **Ciclo 2 (Calendario)** ✅ completi (CRUD, ricorrenze RRULE + eccezioni, condivisione/inviti, link pubblico, relazioni + privacy, confronto disponibilità, room effimere, eventi-contatto, refactor UX mobile dark, vista ufficiale a layer con pin per-utente).
- **Ciclo 6 (Integrazioni Google/Microsoft)** ✅ fatto da Codex fuori ordine (sync bidirezionale, OAuth, webhook, coda `external_calendar_sync_jobs`, crittografia token).
- **Ciclo 3** (modello a `actions` separate): **revertato**. DB pulito (nessuna tabella `actions`/`action_completions`; `calendar_events` come baseline `d402671` — la colonna placeholder `action_id` è inutilizzata).

## STATO: DEBITI / cose aperte
1. **Zero test**: manca un test runner; servono unit minime su `resolveEventVisibility`, free-slot, espansione ricorrenze.
2. **RLS mancanti** sulle tabelle non-core (event_official_pins, rooms, room_participants, event_exceptions, external_calendar_*). L'autorizzazione vera è applicativa (server = superuser → bypassa RLS); è difesa-in-profondità.
3. **Sync esterna da collaudare**: riempire `.env` con credenziali OAuth reali; confermare chi processa periodicamente `external_calendar_sync_jobs` e rinnova i webhook (serve un cron/scheduled trigger).
4. `calendar_events.action_id`: colonna placeholder ora senza senso nel nuovo modello → rimuovere o ignorare quando si tocca lo schema eventi nel Ciclo 4.

## PROSSIMO STEP: Ciclo 4 — Obiettivi + Skill
Aprire `docs/action-plan/04-ciclo-obiettivi-skill.md` (ha una nota in testa sul modello corretto). Ora il Ciclo 4 possiede anche ciò che era nel vecchio Ciclo 3:
- `objectives`, `skills`, `skill_weights`, ponti **`event_objectives`** / **`event_skills`**, log **`event_completions`** (per-occorrenza), campo **peso (1/2/3)** su `calendar_events`;
- estensioni al form evento (sezioni Obiettivi/Skill) e comando **"segna come svolto"** su un'occorrenza;
- motore punteggio/streak/consistency, Skill Level/Momentum, badge.

Nodi aperti per il Ciclo 4: eventi esterni (`source != life_app`) devono poter essere Action; completamento per-occorrenza con unique `(calendar_event_id, occurrence_date)` e annullamento per chiave; predisporre i Todo futuri (ponti polimorfici o paralleli — fuori scope finché i Todo non esistono).

## Come ripartire (prima azione nella nuova chat)
1. `git status` + `git log --oneline -8` (allineamento con Codex).
2. Verificare ambiente: `supabase status` (DB su 53322), `npx nuxi typecheck` e `npm run build` verdi.
3. Leggere PK v2 §3.2/§4 (modello Action corretto) + `04-ciclo-obiettivi-skill.md` e proporre all'utente il piano del **Sotto-Ciclo 4.1** prima di scrivere codice.
