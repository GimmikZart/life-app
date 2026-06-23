# Ciclo 5 — Proprietà

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale e le regole valide per tutti i Sotto-Cicli.

> ⚠️ **Nota modello (revisione 2026-06).** Un'Action è un **evento del calendario** (o, in futuro, un Todo) associato a Skill/Obiettivi/Proprietà — non un'entità separata (vedi `03-ciclo-action-engine.md`). Il collegamento Proprietà↔Action diventa quindi il ponte **`event_properties`** (`calendar_event_id` + `property_id`), al posto di `action_properties`. Dove sotto si legge "collegare alle Action", intendere "associare agli eventi".

## Obiettivo del Ciclo

Costruire la Core Feature Proprietà, descritta nel Project Knowledge v2 (sezione 3.5) come Core Feature permanente basata su template. Alla fine di questo Ciclo, un utente può aggiungere Proprietà (Casa, Auto, Corpo, personalizzata) da template, con campi e attività suggerite, e collegarle agli eventi (Action) esistenti tramite `event_properties`.

**Prerequisiti generali del Ciclo:** Ciclo 1 e 2 completati (Calendario/eventi). Il Ciclo 4 (Obiettivi+Skill) non è uno stretto prerequisito tecnico, ma il piano di sviluppo lo posiziona prima (vedi `00-piano-di-sviluppo-indice.md`, sezione "Ordine dei Cicli") — se si decide di anticipare le Proprietà rispetto a Obiettivi/Skill, va fatto consapevolmente.

---

## Sotto-Ciclo 5.1 — Schema dati Proprietà

**Obiettivo:** avere nel database la tabella `properties` e la tabella ponte verso le Action.

**Prerequisiti:** Ciclo 3 completato.

**Scope incluso:**
- Tabella `properties` (`id, user_id, name, template_type, attributes JSON`)
- Tabella `action_properties` (tabella ponte N:N, `action_id, property_id`) — creata qui, come deciso nel Sotto-Ciclo 3.1. **Unique constraint su `(action_id, property_id)`**: lo stesso collegamento non può essere duplicato (coerente con gli stessi vincoli già applicati a `action_objectives` e `action_skills` nel Ciclo 4)
- RLS: un utente vede/modifica solo le proprie Proprietà

**Scope escluso:**
- Definizione dei template stessi come dati strutturati (arriva nel Sotto-Ciclo 5.2)
- Logica applicativa

**Output atteso:**
- File di schema Drizzle per `properties` e `action_properties`
- Migrazione eseguibile
- RLS policies su `properties`

**Criteri di completamento:**
- [ ] Tabelle `properties` e `action_properties` create
- [ ] Unique constraint su `(action_id, property_id)` attivo e verificato
- [ ] RLS impedisce a un utente di vedere Proprietà di altri utenti

---

## Sotto-Ciclo 5.2 — Sistema Template (Casa, Auto, Corpo, Personalizzato)

**Obiettivo:** definire i template come da Project Knowledge v2 (sezione 3.5) e permettere all'utente di sceglierne uno per creare una nuova Proprietà.

**Prerequisiti:** Sotto-Ciclo 5.1 completato.

**Scope incluso:**
- Definizione strutturata (es. file di configurazione, non necessariamente tabella DB — coerente con `attributes` come JSON libero) dei template:
  - **Casa:** campi (indirizzo, numero di stanze, metri quadri), Action suggerite (pulizia bagno, pulizia cucina, manutenzioni periodiche)
  - **Auto:** campi (targa, scadenza assicurazione, scadenza revisione, chilometraggio attuale), Action suggerite (cambio gomme, tagliando, revisione)
  - **Corpo:** campi (altezza, peso, circonferenze), Action suggerite (allenamento, stretching, pesata periodica)
  - **Personalizzato:** nessun campo precompilato, l'utente definisce nome, campi e Action di partenza liberamente
- Flusso di creazione Proprietà: scelta del template → compilazione dei campi suggeriti (precompilati come placeholder, modificabili) → opzione di creare subito le Action suggerite (collegandole automaticamente alla Proprietà tramite `action_properties`) o saltare questo passaggio
- Riguardo al nodo aperto "Dettaglio template Proprietà" del Project Knowledge (sezione 6): questo sotto-ciclo risolve la domanda "i template includono Action preconfigurate?" con risposta **sì, come opzione proposta ma non obbligatoria** durante la creazione — documentare questa scelta come decisione presa in questo Ciclo, aggiornando idealmente il Project Knowledge in un secondo momento

**Scope escluso:**
- Aggiunta di nuovi template oltre ai 3 + personalizzato (possono essere aggiunti in futuro senza essere parte di questo Ciclo)

**Output atteso:**
- Struttura dati/configurazione dei template (es. `templates/properties.ts`)
- Flusso UI di creazione Proprietà guidato dal template
- Le Action suggerite, se accettate dall'utente, vengono create come Action reali (tramite la logica del Ciclo 3) e collegate alla Proprietà

**Criteri di completamento:**
- [ ] I 4 template (Casa, Auto, Corpo, Personalizzato) sono selezionabili in creazione
- [ ] La scelta di un template precompila i campi suggeriti, modificabili dall'utente
- [ ] L'utente può accettare la creazione delle Action suggerite o saltarla
- [ ] Le Action create da template sono identiche a quelle create manualmente (stessa tabella, stesso comportamento)

---

## Sotto-Ciclo 5.3 — CRUD Proprietà e collegamento con Action

**Obiettivo:** un utente può gestire le proprie Proprietà esistenti e collegare/scollegare Action a/da una Proprietà, anche dopo la creazione iniziale.

**Prerequisiti:** Sotto-Ciclo 5.2 completato.

**Scope incluso:**
- API/endpoint CRUD per `properties` (modifica nome, attributi, eliminazione)
- UI per modificare i campi di una Proprietà esistente
- UI per collegare/scollegare una o più Action esistenti a una Proprietà, popolando `action_properties` — aggiornamento del form della Action (Sotto-Ciclo 3.2) con la sezione "Proprietà collegate" (al plurale, secondo la relazione N:N decisa nel Project Knowledge v2)
- Vista di dettaglio di una Proprietà che mostra tutte le Action collegate e i relativi prossimi appuntamenti/scadenze (derivati dagli eventi calendario generati dalle Action)
- Verifica/attivazione del badge 🧩 Costruttore (definito nel Sotto-Ciclo 4.7, se il Ciclo 4 è già stato completato) alla creazione della prima Proprietà personalizzata — se il Ciclo 4 non è ancora stato completato quando si esegue questo sotto-ciclo, segnalarlo come collegamento da completare in seguito invece di bloccare lo sviluppo

**Scope escluso:**
- Logica di Skill (le Proprietà restano NON collegate alle Skill, per decisione architetturale esplicita del Project Knowledge v2, sezione 5)

**Output atteso:**
- Endpoint CRUD per `properties`
- Pagina "Le mie Proprietà" con lista e dettaglio per singola Proprietà
- Form Action aggiornato con sezione "Proprietà collegate" (multi-selezione)

**Criteri di completamento:**
- [ ] Un utente modifica i campi di una Proprietà esistente
- [ ] Un utente collega una Action a più Proprietà contemporaneamente (es. "Pulizia generale" su Casa e Auto, come da esempio nel Project Knowledge v2 sezione 5)
- [ ] La vista di dettaglio Proprietà mostra le Action collegate e le relative prossime occorrenze
- [ ] Le Proprietà non hanno alcun campo o collegamento diretto verso le Skill

---

## Fine del Ciclo 5

Al termine di questo Ciclo: tutte le Core Feature della V1 (Calendario, Action Engine, Obiettivi, Skill, Proprietà) sono complete e collegate tra loro tramite le Action, secondo il modello "Action = centro dati" del Project Knowledge v2. Si può procedere al Ciclo 6 — Integrazioni esterne (`06-ciclo-integrazioni-esterne.md`).
