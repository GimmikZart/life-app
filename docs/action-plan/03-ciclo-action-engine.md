# Ciclo 3 — Action Engine

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale e le regole valide per tutti i Sotto-Cicli.

## Obiettivo del Ciclo

Costruire l'Action Engine, descritto nel Project Knowledge v2 (sezione 3.2) come il **centro del modello dati** di tutta l'applicazione. Alla fine di questo Ciclo, un utente può creare Action configurabili (peso, frequenza), collegarle al Calendario, e l'infrastruttura sarà pronta per collegarle a Obiettivi, Skill e Proprietà nei Cicli successivi (i collegamenti effettivi a Obiettivi/Skill/Proprietà verranno completati nei rispettivi Cicli, ma le tabelle ponte e l'architettura vanno create qui).

**Prerequisiti generali del Ciclo:** Ciclo 1 (Setup) e Ciclo 2 (Calendario) completati.

---

## Sotto-Ciclo 3.1 — Schema dati Action Engine

**Obiettivo:** avere nel database la tabella `actions` e le tabelle ponte necessarie, come da Project Knowledge v2 sezione 4, con un legame esplicito e univoco tra un completamento e l'occorrenza pianificata a cui si riferisce.

**Prerequisiti:** Ciclo 2 completato.

**Scope incluso:**
- Tabella `actions` (`id, user_id, name, weight (1|2|3), frequency (JSON), is_template (boolean)`)
- **Decisione presa in questa revisione — identificazione dell'occorrenza completata.** Il feedback di revisione segnalava correttamente che, senza un riferimento esplicito all'occorrenza, calcolare streak, consistency score e permettere l'annullamento di un completamento diventa ambiguo (quale occorrenza è stata completata, se la Action è ricorrente e ha generato più eventi calendario?). Si introduce quindi:
  - `calendar_events.action_id` (già previsto, attivato in questo sotto-ciclo come foreign key reale verso `actions.id`) identifica quali eventi calendario sono "occorrenze" generate da una Action
  - Tabella `action_completions` con i campi: `id, action_id, user_id, calendar_event_id (FK → calendar_events, nullable), occurrence_date (date, not null), completed_at (timestamp, not null), points_awarded (JSON), notes (nullable)`
  - `occurrence_date` rappresenta la data dell'istanza pianificata che è stata completata (es. "la sessione di lunedì 16 giugno"), indipendentemente da quando è stata effettivamente marcata come completata (`completed_at`, che può differire, es. completamento segnato in ritardo)
  - `calendar_event_id` collega il completamento al evento calendario specifico, quando esiste (cioè quando l'occorrenza è stata materializzata come evento dal Sotto-Ciclo 3.3 — vedi sotto). Resta nullable per coprire il caso limite di Action senza generazione automatica di eventi, ma il caso standard previsto da questo piano è che sia sempre popolato
  - **Unique constraint su `(action_id, occurrence_date)`**: non è possibile completare due volte la stessa occorrenza della stessa Action. Questo è anche il meccanismo che rende sicuro e non ambiguo l'annullamento di un completamento (Sotto-Ciclo 3.4): si identifica la riga da rimuovere tramite `(action_id, occurrence_date)`, non tramite ricerca approssimata su `completed_at`
- Tabelle ponte vuote pronte a essere popolate nei Cicli successivi: `action_objectives` (`action_id, objective_id`), `action_properties` (`action_id, property_id`), `action_skills` (`action_id, skill_id, contribution_weight, type`) — queste tabelle fanno riferimento a tabelle (`objectives`, `properties`, `skills`) che non esistono ancora nel Ciclo 3. **Decisione di questo piano:** creare `action_objectives` e `action_skills` nei Cicli 4 (Obiettivi+Skill) e `action_properties` nel Ciclo 5 (Proprietà), non in questo Sotto-Ciclo — qui si crea solo `actions` e `action_completions`, che sono le tabelle che l'Action Engine possiede direttamente
- RLS: un utente vede/modifica solo le proprie Action e i propri completamenti

**Scope escluso:**
- Tabelle ponte verso Obiettivi, Skill, Proprietà (vedi sopra — rimandate ai rispettivi Cicli)
- Logica applicativa

**Output atteso:**
- File di schema Drizzle per `actions`, `action_completions` (con i campi `calendar_event_id` e `occurrence_date` e il relativo unique constraint)
- Migrazione che attiva la foreign key `calendar_events.action_id`
- RLS policies su `actions` e `action_completions`

**Criteri di completamento:**
- [ ] Tabelle `actions` e `action_completions` create, inclusi `calendar_event_id` e `occurrence_date`
- [ ] Foreign key `calendar_events.action_id → actions.id` attiva
- [ ] Unique constraint su `(action_id, occurrence_date)` attivo e verificato
- [ ] RLS impedisce a un utente di vedere Action di altri utenti

---

## Sotto-Ciclo 3.2 — CRUD Action e configurazione

**Obiettivo:** un utente può creare, modificare, eliminare, duplicare una Action con tutti i suoi parametri di configurazione di base (nome, peso, frequenza).

**Prerequisiti:** Sotto-Ciclo 3.1 completato.

**Scope incluso:**
- API/endpoint CRUD per `actions`
- Form di creazione/modifica Action con: nome (libero), peso (1/2/3 con etichette "routine leggera / impegno medio / sforzo significativo" come da Project Knowledge v2 sezione 3.2), frequenza (giornaliera, settimanale, mensile, data specifica)
- Funzione "copia Action" (copy & paste con parametri modificabili, come da Project Knowledge v2 sezione 3.2) — crea una nuova Action con gli stessi parametri, modificabile subito dopo la copia
- I collegamenti a Obiettivi/Proprietà/Skill NON sono ancora configurabili in questo sotto-ciclo (le tabelle ponte non esistono ancora per Obiettivi/Skill/Proprietà) — il form deve essere strutturato in modo da poter aggiungere quelle sezioni in seguito senza refactoring pesante, ma in questo sotto-ciclo quelle sezioni restano assenti o disabilitate

**Scope escluso:**
- Collegamento a Obiettivi, Skill, Proprietà (arriveranno nei rispettivi Cicli, quando le tabelle ponte esisteranno)
- Generazione automatica di eventi a calendario dalla frequenza (arriva nel Sotto-Ciclo 3.3)

**Output atteso:**
- Endpoint CRUD per `actions`
- Pagina "Le mie Action" con lista, creazione, modifica, duplicazione

**Criteri di completamento:**
- [ ] Un utente crea una Action con nome, peso, frequenza
- [ ] Un utente duplica una Action esistente e ne modifica i parametri
- [ ] Un utente modifica ed elimina una Action

---

## Sotto-Ciclo 3.3 — Generazione eventi a calendario dalla frequenza dell'Action

**Obiettivo:** una Action con una frequenza pianificata genera automaticamente le occorrenze corrispondenti sul Calendario, collegate via `calendar_events.action_id`.

**Prerequisiti:** Sotto-Ciclo 3.2 completato.

**Scope incluso:**
- Logica che, alla creazione/modifica di una Action con frequenza ricorrente, genera (o aggiorna) gli eventi calendario collegati per un orizzonte temporale ragionevole (es. i prossimi 3-6 mesi, rigenerabile quando l'orizzonte si avvicina alla fine — la strategia esatta va scelta dall'AI e documentata, dato che il Project Knowledge non specifica l'orizzonte)
- Ogni evento calendario generato corrisponde esattamente a una occorrenza pianificata: la data dell'evento generato è la stessa che verrà poi usata come `occurrence_date` quando l'occorrenza verrà completata (Sotto-Ciclo 3.4) — questa corrispondenza 1:1 tra evento generato e occorrenza è ciò che rende possibile il collegamento `calendar_event_id` introdotto nel Sotto-Ciclo 3.1
- Per Action a "data specifica" (non ricorrente), creazione di un singolo evento calendario collegato
- Su quale calendario va creato l'evento generato: di default il calendario "Personale" dell'utente, salvo che l'utente non scelga esplicitamente un altro calendario nel form della Action (aggiungere questa opzione al form del Sotto-Ciclo 3.2 se non già presente)
- Coerenza bidirezionale minima: se l'utente elimina la Action, gli eventi calendario generati e non ancora completati vengono rimossi; se l'utente elimina manualmente un singolo evento generato, questo non deve eliminare la Action (sono entità distinte collegate). Se un evento generato viene eliminato manualmente prima di essere completato, la corrispondente occorrenza futura non sarà più completabile da calendario (resta da chiarire nel Sotto-Ciclo 3.4 se debba restare completabile da altrove — vedi nodo aperto in quel sotto-ciclo)

**Scope escluso:**
- Marcatura di completamento dell'Action dall'evento calendario (arriva nel Sotto-Ciclo 3.4)
- Qualsiasi logica di punteggio/Skill (arriva nel Ciclo 4)

**Output atteso:**
- Job/funzione di generazione eventi da Action, eseguita alla creazione/modifica della Action
- Aggiornamento della Today View (Sotto-Ciclo 2.4) per mostrare effettivamente le "Action pianificate per oggi", ora che esistono eventi calendario collegati ad Action

**Criteri di completamento:**
- [ ] Una Action ricorrente genera correttamente gli eventi calendario futuri, con una corrispondenza 1:1 verificabile tra evento e occorrenza pianificata
- [ ] Una Action a data specifica genera il singolo evento corrispondente
- [ ] L'eliminazione di una Action rimuove gli eventi futuri generati
- [ ] La Today View mostra le Action pianificate per oggi

---

## Sotto-Ciclo 3.4 — Completamento Action e log dei completamenti

**Obiettivo:** un utente può segnare un'occorrenza di Action come completata, generando una riga in `action_completions` univocamente identificata e annullabile senza ambiguità.

**Prerequisiti:** Sotto-Ciclo 3.3 completato.

**Scope incluso:**
- UI per marcare un'occorrenza di Action come completata (dalla Today View, dalla vista calendario, o da una vista dedicata "Action di oggi"), partendo sempre da un evento calendario specifico (`calendar_event_id` noto) — questo è il punto in cui si usa concretamente il collegamento deciso nel Sotto-Ciclo 3.1
- Alla marcatura, creazione di una riga in `action_completions` con `action_id`, `calendar_event_id`, `occurrence_date` (presa dalla data dell'evento calendario), `completed_at` (timestamp reale del momento in cui l'utente marca il completamento) e `notes` opzionali
- `points_awarded` viene scritto come oggetto vuoto/placeholder in questo sotto-ciclo (il calcolo reale arriva nel Ciclo 4 quando esistono le Skill)
- Possibilità di "annullare" un completamento appena segnato: l'annullamento identifica la riga da rimuovere tramite `(action_id, occurrence_date)`, non tramite ricerca su `completed_at`, eliminando l'ambiguità segnalata in fase di revisione. Il limite temporale per l'annullamento ("entro la stessa sessione/giornata") resta una scelta di prodotto da implementare come validazione lato applicativo (es. confronto tra `now()` e `completed_at`), non come vincolo di schema
- Indicatore visivo di completamento sull'evento calendario corrispondente
- **Nodo aperto esplicito:** cosa succede se un'occorrenza viene completata ma l'evento calendario collegato viene poi eliminato manualmente? In questo sotto-ciclo si decide che `action_completions.calendar_event_id` punta con `ON DELETE SET NULL` (l'evento può essere eliminato, il completamento storico resta con `calendar_event_id = NULL` ma `occurrence_date` intatto, preservando comunque streak e consistency). Documentare questa scelta nel codice della migrazione

**Scope escluso:**
- Calcolo punti, streak, consistency score (Ciclo 4)
- Qualsiasi riferimento a Skill

**Output atteso:**
- Endpoint per marcare/annullare completamento, basato su `(action_id, occurrence_date)`
- UI di completamento integrata nella Today View e nella vista calendario

**Criteri di completamento:**
- [ ] Un utente marca un'occorrenza di Action come completata, partendo da un evento calendario specifico
- [ ] Viene creata la riga corrispondente in `action_completions` con `calendar_event_id` e `occurrence_date` popolati correttamente
- [ ] Un tentativo di completare due volte la stessa occorrenza viene respinto dal unique constraint
- [ ] Un completamento può essere annullato senza ambiguità, identificato da `(action_id, occurrence_date)`
- [ ] L'eliminazione di un evento calendario collegato non distrugge lo storico del completamento (verificabile: `calendar_event_id` diventa null, `occurrence_date` resta)
- [ ] L'evento calendario mostra visivamente lo stato di completamento

---

## Fine del Ciclo 3

Al termine di questo Ciclo: le Action esistono come unità autonome, generano eventi a calendario secondo la loro frequenza con una corrispondenza 1:1 tracciabile tra evento e occorrenza, e possono essere completate con un log storico non ambiguo. Manca ancora il collegamento a Obiettivi, Skill e Proprietà (tabelle ponte) e tutto il sistema di punteggio — questi arrivano nei Cicli successivi. Si può procedere al Ciclo 4 — Obiettivi + Skill (`04-ciclo-obiettivi-skill.md`).
