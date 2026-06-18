# Ciclo 1 — Setup

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale e le regole valide per tutti i Sotto-Cicli.

## Obiettivo del Ciclo

Mettere in piedi l'infrastruttura di base del progetto: repository, stack tecnologico, connessione al database, autenticazione utenti. Alla fine di questo Ciclo non esiste ancora nessuna Core Feature visibile all'utente finale, ma esiste un'app che si avvia, permette login/signup, e ha un database collegato e pronto a ricevere le tabelle dei Cicli successivi.

## Stack di riferimento (da Project Knowledge v2, sezione 2)

- Frontend: Vue.js 3 + Nuxt 4
- Backend & DB: Supabase (PostgreSQL), con RLS
- ORM: Drizzle ORM
- Architettura dati: cloud di default, cache locale aggressiva + UI ottimistica (la cache verrà introdotta nei Cicli successivi quando ci sarà contenuto da cachare; in questo Ciclo basta la connessione cloud)

---

## Sotto-Ciclo 1.1 — Inizializzazione progetto e tooling

**Obiettivo:** avere un progetto Nuxt 4 funzionante, con linting, formattazione e struttura cartelle pronta.

**Prerequisiti:** nessuno.

**Scope incluso:**
- Inizializzazione progetto Nuxt 4 con Vue 3
- Configurazione TypeScript
- ESLint + Prettier (o equivalente) con regole base
- Struttura cartelle iniziale (es. `components/`, `composables/`, `server/`, `pages/`, `types/`)
- File `.env.example` con le variabili che serviranno (placeholder per Supabase URL/key)
- Script `package.json` per dev, build, lint

**Scope escluso:**
- Nessuna pagina applicativa reale (va bene una home page placeholder)
- Nessuna connessione a Supabase ancora (arriva nel Sotto-Ciclo 1.2)
- Nessun componente UI definitivo

**Output atteso:**
- Repository con progetto Nuxt 4 avviabile via `npm run dev`
- `tsconfig.json`, `.eslintrc`, `.prettierrc` (o equivalenti) configurati
- `README.md` minimo con istruzioni di setup locale

**Criteri di completamento:**
- [ ] `npm install && npm run dev` avvia l'app senza errori
- [ ] Lint passa senza errori su un progetto vuoto
- [ ] Struttura cartelle coerente con le convenzioni Nuxt 4
- [ ] `.env.example` presente e documentato nel README

---

## Sotto-Ciclo 1.2 — Connessione Supabase + Drizzle ORM

**Obiettivo:** avere il progetto collegato a un'istanza Supabase, con Drizzle configurato per gestire schema e migrazioni.

**Prerequisiti:** Sotto-Ciclo 1.1 completato.

**Scope incluso:**
- Configurazione client Supabase (lato server e lato client secondo le convenzioni Nuxt)
- Configurazione Drizzle ORM puntato al database Supabase (PostgreSQL)
- Setup cartella `db/` o `server/db/` con configurazione connessione e file di schema vuoto pronto a essere popolato
- Script per generare ed eseguire migrazioni Drizzle
- Tabella `users` minimale come da Project Knowledge v2 (sezione 4): `id, email, name, avatar, preferences (JSON)`
- Verifica che la tabella `users` sia raggiungibile da una query di test

**Scope escluso:**
- Logica di autenticazione vera e propria (arriva nel Sotto-Ciclo 1.3)
- Tutte le altre tabelle del Project Knowledge (calendars, actions, ecc.) — verranno create nei rispettivi Cicli, non qui
- RLS policies complesse (in questo sotto-ciclo basta che la connessione funzioni; le policy specifiche arrivano insieme alle feature che proteggono)

**Output atteso:**
- `drizzle.config.ts`
- `db/schema/users.ts` (o percorso equivalente) con la tabella `users`
- Migrazione generata ed eseguibile
- Una utility/composable per ottenere il client Supabase lato server

**Criteri di completamento:**
- [ ] Connessione a Supabase funzionante (variabili d'ambiente lette correttamente)
- [ ] Migrazione Drizzle crea la tabella `users` nel database
- [ ] Una query di test (anche solo uno script o un endpoint temporaneo) legge/scrive correttamente sulla tabella `users`

---

## Sotto-Ciclo 1.3 — Autenticazione utenti

**Obiettivo:** un utente può registrarsi, accedere, disconnettersi. Le route applicative sono protette.

**Prerequisiti:** Sotto-Ciclo 1.2 completato.

**Scope incluso:**
- Integrazione Supabase Auth (email/password come metodo minimo; OAuth provider come Google possono essere aggiunti se non aggiungono complessità significativa, ma non sono obbligatori in questo sotto-ciclo)
- Pagine: Signup, Login, Logout
- Middleware/guard Nuxt per proteggere le route autenticate
- Sincronizzazione: alla creazione di un nuovo utente Supabase Auth, creare la riga corrispondente nella tabella `users` (trigger DB o hook applicativo, a scelta dell'AI, da documentare)
- Gestione sessione lato client (stato utente corrente disponibile via composable, es. `useUser()`)

**Scope escluso:**
- Gestione profilo utente avanzata (modifica avatar, preferenze) — non è richiesta dal Project Knowledge come priorità, rimandabile
- Recupero password con flussi custom oltre a quanto Supabase offre di default
- Qualsiasi logica legata a Core Feature (Calendario, Action, ecc.)

**Output atteso:**
- Pagine `/login`, `/signup`
- Middleware di autenticazione applicato alle route protette
- Composable `useUser()` (o equivalente) per leggere lo stato dell'utente loggato
- Riga in `users` creata automaticamente alla registrazione

**Criteri di completamento:**
- [ ] Un utente può registrarsi con email/password
- [ ] Un utente può fare login e logout
- [ ] Le route non autenticate vengono respinte/redirette al login
- [ ] Alla registrazione viene creata la riga corrispondente in `users`
- [ ] Lo stato utente è leggibile da un composable condiviso

---

## Sotto-Ciclo 1.4 — Layout applicativo base e navigazione

**Obiettivo:** avere una shell applicativa (header, navigazione, area contenuto) pronta ad accogliere la Today View del Ciclo Calendario e le altre Core Feature.

**Prerequisiti:** Sotto-Ciclo 1.3 completato.

**Scope incluso:**
- Layout principale con: header/barra di navigazione, area utente (nome, logout), placeholder per le voci di menu delle Core Feature (Calendario, Obiettivi, Skill, Proprietà — anche se le pagine dietro sono vuote/placeholder)
- Pagina vuota "Coming soon" per ogni Core Feature non ancora sviluppata, raggiungibile dal menu
- Gestione responsive minima (la PWA deve essere usabile da mobile, secondo Project Knowledge v2 sezione 2 — Roadmap piattaforme)
- Configurazione base PWA (manifest, icone placeholder, service worker minimo) — non è richiesta una strategia di caching avanzata in questo sotto-ciclo

**Scope escluso:**
- Cache locale aggressiva e UI ottimistica reali (richiedono contenuto da cachare, arriveranno nei Cicli successivi)
- Design system definitivo (va bene uno stile coerente ma minimale)
- Contenuto reale delle Core Feature

**Output atteso:**
- Layout Nuxt (`layouts/default.vue` o equivalente)
- Voci di navigazione verso le pagine placeholder delle Core Feature
- `manifest.json` PWA base e registrazione service worker

**Criteri di completamento:**
- [ ] L'utente loggato vede un layout con navigazione verso tutte le Core Feature (anche se placeholder)
- [ ] L'app è installabile come PWA (manifest valido)
- [ ] Il layout è usabile su viewport mobile e desktop
- [ ] Logout raggiungibile dal layout

---

## Fine del Ciclo 1

Al termine di questo Ciclo: progetto avviabile, utenti possono autenticarsi, database collegato con la tabella `users`, shell applicativa pronta. Si può procedere al Ciclo 2 — Calendario (`02-ciclo-calendario.md`).
