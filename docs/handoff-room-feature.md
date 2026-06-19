# Handoff — Feature "Room" (disponibilità momentanea) — punto 4 del workflow

> Documento di passaggio di consegne. Se il lavoro si interrompe, Codex può riprendere da qui.
> Contesto generale: vedi `docs/action-plan/02-ciclo-calendario.md` e la memoria del progetto.
> Stack: Nuxt 4 / Vue 3, Supabase + Drizzle. DB locale su porta 55322. Migrazioni applicate con `supabase migration up --local`.

## Obiettivo
Utente A crea una **room momentanea** e invita altri (via link o invito app). Una volta dentro, tutti i partecipanti hanno **visibilità temporanea** sugli impegni di tutti (in chiaro o "occupato" a scelta di ciascuno), per vedere a colpo d'occhio i buchi liberi + un bottone "trova slot liberi". La room è **effimera**: ha una scadenza (`expiresAt`). La visibilità NON dipende dalle relazioni permanenti (a differenza di `/api/availability`): ogni partecipante sceglie cosa esporre alla room.

## Modello dati (schema in `server/database/schema/rooms.ts`)
- enum `room_participant_visibility` = ['clear','busy']
- `rooms`: id, token (text unique, per il link), creator_id (-> users, cascade), title (text nullable), expires_at (timestamptz nullable), created_at (timestamptz default now())
- `room_participants`: room_id (-> rooms cascade), user_id (-> users cascade), visibility (enum default 'busy'), joined_at (default now()); unique(room_id,user_id); index(user_id)

## Endpoint (server/api/rooms/…)
- [x] `POST /api/rooms` → crea room (body: title?, durationHours? default 24). Il creatore entra come partecipante (visibility 'busy'). Ritorna {room:{...token}}.
- [x] `GET /api/rooms` → le mie room attive (create o a cui partecipo, non scadute).
- [x] `GET /api/rooms/[token]` → meta room + partecipanti (nomi) + `isParticipant` + `myVisibility`. Se non partecipante: ritorna meta minimale + needsJoin=true.
- [x] `POST /api/rooms/[token]/join` → entro nella room (idempotente, visibility default 'busy'). 403 se scaduta.
- [x] `PATCH /api/rooms/[token]/me` → aggiorna la mia visibility nella room ('clear'|'busy').
- [x] `DELETE /api/rooms/[token]/me` → esco dalla room.
- [x] `GET /api/rooms/[token]/availability?from&to` → occorrenze di tutti i partecipanti (titolo se la LORO room-visibility è 'clear', altrimenti 'Occupato'), usando i loro calendari ufficiali (primario + auto_integrate). Solo per partecipanti, 403 se scaduta. Forma: {participants:[{id,name,email,visibility}], occurrences:[{id,ownerUserId,title,startAt,endAt,busy}]}.

## Frontend (app/pages/calendar/rooms/…)
- [x] `rooms/index.vue` → lista mie room + "Crea room" (crea e apre la room; il link si copia dalla vista room).
- [x] `rooms/[token].vue` → vista room: se non partecipante mostra "Entra"; se dentro: invito (copia link), toggle "cosa vedono di me" (clear/busy), periodo (settimana/mese/mese prossimo/custom), overlay impegni color-coded, "Trova slot liberi" (fascia + durata), esci.
- [x] Voce menu header "Le mie room" → /calendar/rooms (in `app/composables/useHeaderMenu.ts`).

## Riuso algoritmo slot liberi
- [x] Creato composable `app/composables/useFreeSlots.ts` (computeFreeSlots + groupByDay), usato nella room.
- [ ] (Opzionale, non fatto) Refactor di `availability.vue` per usare lo stesso composable: ora ha una copia locale duplicata. Dedup quando comodo (basso rischio ma non urgente).

## Verifica finale
- [x] `npx nuxi typecheck` → exit 0
- [x] `npm run build` → exit 0 (rotte registrate: `/api/rooms`, `/api/rooms/:token`, `/join`, `/me`, `/availability`)
- [ ] **DA FARE (Docker era spento durante lo sviluppo): applicare la migrazione** `20260619131125_polite_maelstrom.sql`. Passi: avvia Docker Desktop → `supabase start` (se serve) → `supabase migration up --local`.
- [ ] riavviare dev server (`NUXT_IGNORE_LOCK=1 npm run dev`), smoke test rotte. Test end-to-end richiede 2+ account (crea room con A, apri il link con B/C, verifica overlay + slot liberi).

## Note / criticità
- "Finché la pagina è aperta" (presence realtime) NON implementato: si usa `expires_at` (scadenza a tempo) come meccanismo effimero. Presence realtime = enhancement futuro (Supabase realtime).
- La room bypassa le relazioni: l'accesso è dato dall'essere partecipante (token). Attenzione RLS/permessi: gli endpoint controllano la partecipazione a livello applicativo.

## STATO ATTUALE
**Codice COMPLETO** (backend + frontend), typecheck + build puliti. **Unico passo mancante: applicare la migrazione al DB** (Docker era spento durante lo sviluppo) e poi il test runtime con 2+ account. Vedi "Verifica finale".
