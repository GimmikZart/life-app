# Ciclo 2 — Calendario

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale e le regole valide per tutti i Sotto-Cicli.

## Obiettivo del Ciclo

Costruire la Core Feature Calendario, descritta nel Project Knowledge v2 (sezione 3.1) come centro dell'esperienza utente. Questo Ciclo include il **primo MVP del prodotto**: il calendario condiviso (Project Knowledge v2, sezione 7 — "Primo MVP"). Alla fine di questo Ciclo, due utenti devono poter creare eventi, condividere calendari e vedere a colpo d'occhio i momenti liberi in comune.

Le integrazioni con calendari esterni (Google, Outlook, CalDAV) sono **escluse** da questo Ciclo: hanno un Ciclo dedicato (`06-ciclo-integrazioni-esterne.md`) perché richiedono OAuth, webhook e sincronizzazione bidirezionale — complessità che va isolata dal cuore del modello dati del Calendario.

**Prerequisiti generali del Ciclo:** Ciclo 1 — Setup completato (DB connesso, auth funzionante, layout pronto).

---

## Aggiornamento di scope (revisione 2026-06-18) — Modello a layer e integrazione

> Deviazione consapevole dal Project Knowledge v2, concordata dopo il completamento di 2.5a. Documentata qui invece di applicata in sordina (regola 3 dell'indice).

La feature Calendario viene estesa con il concetto di **layer**: un calendario è un livello accendibile/spegnibile, e la "vista ufficiale" dell'utente è la composizione di più layer (gli eventi non si spostano né si duplicano). Si distinguono due meccanismi:

- **(A) Calendario condiviso** (`calendar_members`): calendario co-posseduto da più persone. Già coperto da 2.2.
- **(B) Connessione tra utenti** (`relationships`): ognuno tiene i propri calendari; serve solo a confrontare le disponibilità con regole di privacy.

**Modifiche allo schema (rispetto al Project Knowledge v2):**
- `calendar_members.is_primary` (bool) — il calendario primario dell'utente (uno solo, destinazione default dei nuovi eventi, sempre integrato). Auto-creato alla registrazione ("Personale").
- `calendar_members.auto_integrate` (bool) — il calendario confluisce nella vista ufficiale dell'utente e conta come "occupato". La preferenza è **per-utente** (sul membership), non sul calendario.
- `calendar_events.pinned_to_primary` (bool) — integrazione manuale non distruttiva del singolo evento nella vista ufficiale del proprietario.

**Step di implementazione (sostituiscono/estendono 2.5b):**
1. **Layer & primario** — schema sopra, auto-creazione primario, filtro `calendarIds` + scope `official` su `/api/calendar-events`, select calendario in alto nel board (default primario), controlli primario/integrazione nel pannello gestione, pin evento. *(stato: FATTO)*
2. **Connessioni reciproche + privacy** — handshake con `status` sulle relationships (pending/accepted/declined), riga reciproca creata all'accettazione, default di visibilità invertito a `busy` (privato), UI invita/accetta/rifiuta + richieste inviate/ricevute + connessioni attive. `resolveEventVisibility` applica solo relazioni accettate. *(stato: FATTO — test runtime richiede un secondo account)*
3. **Motore Free/Busy + overlay N utenti** — endpoint `GET /api/availability` (disponibilità ufficiale propria + delle persone connesse, risolta con le regole dei proprietari), vista `/calendar/availability` con selezione persone + range (settimana/mese/mese prossimo/personalizzato) + bottone "Trova slot liberi" (algoritmo sweep-line lato client con fascia oraria e durata minima) + lista impegni di tutti color-coded. *(stato: FATTO — test runtime richiede 2+ account connessi con eventi)*. Resta da agganciare la sezione "Disponibilità condivise" nella Today View (placeholder) e l'idea futura della "room via link condiviso" (deferita).

---

## Sotto-Ciclo 2.1 — Schema dati Calendario

**Obiettivo:** avere nel database tutte le tabelle necessarie al Calendario, come da Project Knowledge v2 sezione 4, con i vincoli di unicità e i campi necessari a supportare le regole di visibilità per categoria.

**Prerequisiti:** Ciclo 1 completato.

**Scope incluso:**
- Tabella `calendars` (`id, user_id, name, color, type` con type tra `personal | couple | family | work | custom`)
- Tabella `calendar_members` (`calendar_id, user_id, permission, status`) — vedi Sotto-Ciclo 2.2 per il significato di `status` (modello inviti). `permission` tra `owner | editor | viewer`. **Unique constraint su `(calendar_id, user_id)`**: un utente non può avere due righe di membership per lo stesso calendario
- Tabella `calendar_events` — **solo i campi non legati a integrazioni esterne** in questo sotto-ciclo: `id, user_id, calendar_id, title, category, start_at, end_at, is_recurring, recurrence_rule, visibility_default`. I campi `source`, `external_id` vanno comunque inclusi nello schema fin da ora (per evitare migrazioni future invasive) ma non verranno popolati/usati fino al Ciclo 6
  - **Decisione presa in questa revisione — campo `category`:** stringa libera (non enum fisso), nullable, definita dall'utente per etichettare un evento (es. "lavoro", "famiglia", "sport"). Serve a supportare la regola di visibilità "mostra tutto tranne una categoria specifica" (Project Knowledge v2, sezione 3.1). Non è prevista in questo Ciclo una gestione di categorie come entità a sé (niente tabella `categories` con CRUD dedicato): è un campo testuale libero sull'evento, eventualmente con autocomplete lato UI basato sulle categorie già usate dall'utente. Se in futuro servirà una gestione più strutturata, sarà una migrazione separata
- Tabella `relationships` (`id, user_id, target_user_id, relationship_type, visibility_rules`). **Unique constraint su `(user_id, target_user_id)`**: una sola relazione attiva tra due utenti nella stessa direzione
- Tabella `event_visibility_overrides` (`event_id, target_user_id, visibility`). **Unique constraint su `(event_id, target_user_id)`**: una sola sovrascrittura per coppia evento/utente target
- Tabella `event_associations` (`event_id, associated_user_id, display_config`). **Unique constraint su `(event_id, associated_user_id)`**
- RLS policies di base: un utente vede solo i calendari di cui è membro con `status = 'accepted'`; un utente vede solo gli eventi dei calendari a cui ha accesso, salvo le regole di visibilità (che verranno applicate a livello applicativo nei sotto-cicli successivi, non necessariamente tutte a livello RLS)
- `action_id` nullable su `calendar_events` va incluso nello schema (riferimento a una tabella `actions` che non esiste ancora) ma **non come foreign key attiva** in questo sotto-ciclo — verrà collegata nel Ciclo 3. Lasciare un commento esplicito nel codice che segnala questo collegamento futuro

**Scope escluso:**
- Qualsiasi logica applicativa (CRUD, UI) — solo schema e migrazioni in questo sotto-ciclo
- Logica di sincronizzazione esterna
- Gestione strutturata delle categorie (tabella dedicata) — resta un campo testuale libero, vedi sopra

**Output atteso:**
- File di schema Drizzle per tutte le tabelle elencate, con i unique constraint specificati
- Migrazione eseguibile
- RLS policies di base documentate nel codice (commenti) e applicate su Supabase

**Criteri di completamento:**
- [ ] Tutte le tabelle elencate esistono nel database, incluso il campo `category` su `calendar_events` e il campo `status` su `calendar_members`
- [ ] Tutti i unique constraint elencati sono attivi e verificati (un tentativo di inserimento duplicato fallisce)
- [ ] Le RLS policies di base impediscono a un utente di leggere calendari di cui non è membro accettato
- [ ] Migrazione applicata senza errori

---

## Sotto-Ciclo 2.2 — CRUD Calendari e modello inviti

**Obiettivo:** un utente può creare, rinominare, eliminare i propri calendari e invitare altri utenti con un flusso di invito esplicito (stato pending → accepted/declined).

**Prerequisiti:** Sotto-Ciclo 2.1 completato.

**Scope incluso:**
- API/endpoint per: creare calendario, modificare nome/colore/tipo, eliminare calendario
- Alla creazione di un calendario, l'utente creatore diventa automaticamente `owner` con `status = 'accepted'` in `calendar_members`
- **Modello inviti (decisione presa in questa revisione):** non viene creata una tabella separata per gli inviti. Si riusa `calendar_members` con il campo `status`:
  - Invitare un utente crea una riga in `calendar_members` con `permission` scelto (`editor` o `viewer`) e `status = 'pending'`
  - L'utente invitato, finché lo stato è `pending`, non vede ancora gli eventi del calendario (la RLS del Sotto-Ciclo 2.1 filtra su `status = 'accepted'`) ma vede l'invito stesso in una sezione dedicata ("Inviti in attesa")
  - L'utente invitato può accettare (`status → 'accepted'`) o rifiutare (`status → 'declined'`, oppure eliminazione della riga — scegliere l'opzione più semplice e documentarla: questo piano consiglia di mantenere la riga con `status = 'declined'` per avere traccia storica, evitando che l'owner possa re-invitare creando un duplicato grazie al unique constraint)
  - Solo l'`owner` può invitare; un invito a un utente già membro (in qualsiasi stato) aggiorna la riga esistente invece di crearne una nuova, rispettando il unique constraint `(calendar_id, user_id)`
- API/endpoint per identificare l'utente da invitare: ricerca per email esatta (opzione più semplice scelta in questa revisione, niente ricerca fuzzy o invito di utenti non ancora registrati in questo sotto-ciclo)
- API/endpoint per rimuovere un membro o cambiargli ruolo (solo da parte di `owner`)
- UI minimale: lista calendari dell'utente, form di creazione, gestione membri con sezione "Inviti in attesa" sia per chi invita (stato degli inviti mandati) sia per chi è invitato (inviti ricevuti da accettare/rifiutare)

**Scope escluso:**
- UI definitiva/rifinita (va bene funzionale ma non deve essere il focus)
- Notifiche di invito (email, push) — basta che l'invito risulti nel database e visibile all'utente invitato al prossimo accesso
- Invito di utenti non ancora registrati su Life App (es. invito via email a un indirizzo senza account — fuori scope, l'utente invitato deve già esistere)
- Eventi e ricorrenze (arrivano nel Sotto-Ciclo 2.3)

**Output atteso:**
- Endpoint CRUD per `calendars` e gestione `calendar_members` (invito, accetta, rifiuta, rimuovi, cambia ruolo)
- Pagina "I miei calendari" con possibilità di creare/gestire calendari
- Sezione "Inviti in attesa" (ricevuti e inviati)

**Criteri di completamento:**
- [ ] Un utente crea un calendario e ne diventa owner con status accepted
- [ ] Un utente owner invita un altro utente (per email) con un ruolo specifico, e la riga risultante ha status pending
- [ ] L'utente invitato vede l'invito e può accettarlo o rifiutarlo; solo dopo l'accettazione vede gli eventi del calendario
- [ ] Un secondo invito alla stessa persona sullo stesso calendario aggiorna la riga esistente, non la duplica
- [ ] Un utente viewer non può modificare il calendario, un editor sì (verificabile da RLS + logica applicativa)
- [ ] Un calendario può essere eliminato dall'owner

---

## Sotto-Ciclo 2.3 — CRUD Eventi e ricorrenze

**Obiettivo:** un utente può creare, modificare, eliminare eventi su un calendario, inclusi eventi ricorrenti.

**Prerequisiti:** Sotto-Ciclo 2.2 completato.

**Scope incluso:**
- API/endpoint per creare/modificare/eliminare eventi (`calendar_events`), incluso il campo `category` (libero, opzionale)
- Supporto a `is_recurring` + `recurrence_rule` (RRULE) — generazione delle occorrenze per la visualizzazione calcolata on-the-fly (lato server o client, a scelta dell'AI), **non materializzata riga per riga nel DB** in questo sotto-ciclo
- **Decisione presa in questa revisione — timezone:** tutte le date/ore (`start_at`, `end_at`) sono salvate in UTC nel database. La conversione al timezone dell'utente avviene esclusivamente lato applicativo (UI), mai nello storage. Il timezone di riferimento dell'utente viene letto dal browser/dispositivo per default, con possibilità di override nelle preferenze utente (campo già presente come `users.preferences` JSON, Project Knowledge v2 sezione 4) — non è richiesta una UI dedicata di gestione timezone in questo sotto-ciclo, solo il rispetto della convenzione "sempre UTC a DB"
- Validazione base: `end_at` successivo a `start_at`
- UI minimale per creare un evento (titolo, categoria, data/ora inizio-fine, ricorrenza, calendario di destinazione)

**Scope escluso:**
- Visualizzazione calendario completa (mensile/settimanale/giornaliera) — arriva nel Sotto-Ciclo 2.4
- Visibilità/condivisione granulare (arriva nel Sotto-Ciclo 2.5a)
- Collegamento con Action (arriva nel Ciclo 3)
- Eccezioni di ricorrenza — **RISOLTO (2026-06-22)**: implementato il supporto completo (scope `all`/`single`/`following`) via tabella `event_exceptions` + scope su PATCH/DELETE + UI "Applica a: Solo questo / Questo e successivi / Tutta la serie". Vedi memoria `calendar-feature-design`. (Nodo aperto originale chiuso.)

**Output atteso:**
- Endpoint CRUD per `calendar_events`
- Libreria/utility per il parsing e l'espansione delle RRULE (può essere una libreria esistente, es. `rrule.js`)
- Form di creazione/modifica evento

**Criteri di completamento:**
- [ ] Un utente crea un evento singolo su un proprio calendario, con categoria opzionale
- [ ] Un utente crea un evento ricorrente e le occorrenze vengono calcolate correttamente per un dato intervallo di date
- [ ] Un evento può essere modificato ed eliminato (agendo sull'intera serie se ricorrente)
- [ ] La validazione delle date funziona
- [ ] Tutte le date sono salvate in UTC e visualizzate nel timezone locale dell'utente

---

## Sotto-Ciclo 2.4 — Viste Calendario (mese / settimana / giorno) e Today View

**Obiettivo:** visualizzare gli eventi nelle tre viste previste, e implementare la Today View come home dell'app (Project Knowledge v2, sezione 3.1 e sezione 5 — "Home = Today View").

**Prerequisiti:** Sotto-Ciclo 2.3 completato.

**Scope incluso:**
- Integrazione FullCalendar (Vue) come da stack tecnologico (Project Knowledge v2, sezione 2)
- Vista mensile, settimanale, giornaliera che mostrano gli eventi dei calendari dell'utente
- Today View come home page dell'app, con: timeline della giornata corrente, eventi di oggi, prossimi eventi in arrivo. (Le sezioni "Action pianificate per oggi" e "Disponibilità condivise" vanno predisposte come placeholder/sezioni vuote in questo sotto-ciclo, perché dipendono rispettivamente dal Ciclo 3 - Action Engine e dal Sotto-Ciclo 2.5a di questo stesso Ciclo — completarle non appena le rispettive dipendenze sono pronte)
- Navigazione tra le viste

**Scope escluso:**
- Sovrapposizione di disponibilità tra utenti diversi (arriva nel Sotto-Ciclo 2.5a/2.5b)
- Colori/icone per eventi associati a contatti specifici (arriva nel Sotto-Ciclo 2.6)

**Output atteso:**
- Componente Calendario con switch tra vista mese/settimana/giorno
- Pagina Today View impostata come home page post-login
- Cache locale aggressiva + UI ottimistica per le operazioni su eventi (creazione/modifica percepita come istantanea, sincronizzata in background) — è il primo punto del Ciclo in cui questo principio dell'architettura dati (Project Knowledge v2, sezione 2) va effettivamente implementato

**Criteri di completamento:**
- [ ] Le tre viste (mese/settimana/giorno) mostrano correttamente gli eventi, incluse le ricorrenze
- [ ] La Today View è la home page e mostra correttamente la giornata corrente
- [ ] Le operazioni di creazione/modifica evento sono percepite come istantanee (optimistic UI)
- [ ] L'app funziona in lettura anche offline (cache locale)

---

## Sotto-Ciclo 2.5a — Regole di visibilità per relazione e override per evento

**Obiettivo:** implementare le relazioni tra utenti e le regole di visibilità, con applicazione effettiva quando un utente guarda un calendario condiviso.

> Nota di revisione: questo sotto-ciclo nasce dalla scomposizione del precedente Sotto-Ciclo 2.5, ritenuto troppo ampio per una singola sessione di sviluppo. La parte di overlay visivo multi-calendario è stata spostata nel Sotto-Ciclo 2.5b.

**Prerequisiti:** Sotto-Ciclo 2.4 completato.

**Scope incluso:**
- CRUD per `relationships`: un utente definisce un tipo di relazione libero (es. "Relazione", "Amico", "Genitore" — stringa libera, non enum fisso, come da Project Knowledge v2 sezione 3.1) verso un altro utente
- Configurazione delle `visibility_rules` per tipo di relazione: opzioni "mostra tutto in chiaro", "mostra solo occupato", "mostra tutto tranne una categoria specifica" (quest'ultima usa il campo `category` introdotto nel Sotto-Ciclo 2.1/2.3: la regola specifica una stringa di categoria da escludere)
- CRUD per `event_visibility_overrides`: sovrascrittura della regola di default per singolo evento e singolo utente target
- Applicazione effettiva delle regole in una funzione/servizio centralizzato di "risoluzione visibilità" (data una coppia evento + utente osservatore, restituisce: visibile in chiaro / visibile come occupato / nascosto), che verrà riusato sia dalle viste calendario singole sia dall'overlay del Sotto-Ciclo 2.5b
- Priorità di risoluzione esplicita: override per singolo evento > regola del tipo di relazione > default (`visibility_default` dell'evento stesso, già presente nello schema)

**Scope escluso:**
- Overlay visivo multi-calendario (Sotto-Ciclo 2.5b)
- Mini-CRM per le relazioni (compleanni, anniversari, note) — è un nodo aperto nel Project Knowledge, non in scope
- Colori/icone dedicate per eventi associati (arriva nel Sotto-Ciclo 2.6)

**Output atteso:**
- Endpoint CRUD per `relationships` e `event_visibility_overrides`
- UI per gestire le relazioni e le loro regole di visibilità
- Servizio centralizzato `resolveEventVisibility(event, viewerUserId)` (o equivalente), testato con casi unitari per ciascuna combinazione di priorità

**Criteri di completamento:**
- [ ] Un utente definisce un tipo di relazione verso un altro utente con regole di visibilità
- [ ] Le regole di default per tipo di relazione vengono applicate correttamente, incluso il caso "tutto tranne una categoria"
- [ ] Una sovrascrittura per singolo evento ha priorità sulla regola di default (verificabile con test)
- [ ] Il servizio di risoluzione visibilità è testato unitariamente e riusabile

---

## Sotto-Ciclo 2.5b — Overlay di disponibilità tra utenti

**Obiettivo:** vista che sovrappone calendario proprio e calendario di un altro utente per individuare a colpo d'occhio i buchi liberi in comune — il cuore del valore del calendario condiviso (Project Knowledge v2, sezione 3.1, "Esempio pratico").

**Prerequisiti:** Sotto-Ciclo 2.5a completato.

**Scope incluso:**
- Vista dedicata che, scelto un altro utente con cui esiste una relazione attiva, sovrappone visivamente gli eventi propri e quelli dell'utente selezionato, usando il servizio `resolveEventVisibility` del Sotto-Ciclo 2.5a per decidere cosa mostrare di ciascun evento dell'altro utente
- Evidenziazione degli slot liberi in comune (assenza di eventi per entrambi nello stesso intervallo)
- Selezione del range temporale da confrontare (es. settimana corrente, navigabile)
- Aggiornamento della Today View (placeholder lasciato nel Sotto-Ciclo 2.4) con la sezione "Disponibilità condivise", ora collegata a questa logica

**Scope escluso:**
- Overlay con più di due utenti contemporaneamente (può essere aggiunto in futuro, non richiesto esplicitamente dal Project Knowledge v2 che descrive il caso a due partner)

**Output atteso:**
- Componente/vista "Overlay disponibilità"
- Sezione "Disponibilità condivise" nella Today View collegata e funzionante

**Criteri di completamento:**
- [ ] L'overlay mostra correttamente eventi propri e dell'altro utente, rispettando le regole di visibilità risolte
- [ ] Gli slot liberi in comune sono visivamente identificabili a colpo d'occhio
- [ ] La Today View mostra la sezione "Disponibilità condivise" con dati reali

---

## Sotto-Ciclo 2.6 — Eventi associati a contatti specifici (colori/icone dedicate) — FATTO (2026-06-19)

> Implementato: endpoint `POST /api/event-associations` (upsert) + `DELETE /api/event-associations/[eventId]/[associatedUserId]`; il form crea/modifica evento permette di associare un contatto (dalle connessioni) con colore + icona; colore/icona mostrati nel board e nella Today View. `pinned_to_primary` (booleano owner-only) sostituito da `event_official_pins` (pin PER-UTENTE: posso integrare manualmente nella MIA vista ufficiale qualsiasi evento che vedo, anche di calendari condivisi/pubblici). Test runtime richiede 2+ account.

**Obiettivo:** un evento può essere associato a un contatto specifico e visualizzato con colore/icona dedicati, come da esempio "Cena con Giulia" nel Project Knowledge v2.

**Prerequisiti:** Sotto-Ciclo 2.5b completato.

**Scope incluso:**
- CRUD per `event_associations` (`event_id, associated_user_id, display_config`)
- UI per associare un evento a un contatto e scegliere colore/icona (o assegnazione automatica di un colore/icona di default per quel contatto, modificabile)
- Visualizzazione coerente di questi colori/icone in tutte le viste calendario (mese/settimana/giorno/today view/overlay)

**Scope escluso:**
- Logica avanzata di suggerimento automatico colori (va bene un set di colori/icone predefiniti tra cui scegliere)

**Output atteso:**
- Endpoint CRUD per `event_associations`
- UI integrata nel form evento per scegliere il contatto associato e il suo display

**Criteri di completamento:**
- [ ] Un evento può essere associato a un contatto specifico
- [ ] L'evento associato mostra colore/icona dedicati in tutte le viste, incluso l'overlay
- [ ] La rimozione dell'associazione torna al display di default

---

## Fine del Ciclo 2

Al termine di questo Ciclo: il **primo MVP è completo e utilizzabile**. Due utenti possono creare calendari, condividerli con un flusso di invito esplicito, vedere eventi ricorrenti, applicare regole di visibilità (incluse per categoria) e trovare a colpo d'occhio momenti liberi in comune. Si può procedere al Ciclo 3 — Action Engine (`03-ciclo-action-engine.md`).

> Nota: ricordarsi di tornare sulla Today View (Sotto-Ciclo 2.4) per completare la sezione "Action pianificate per oggi" non appena il Ciclo 3 introduce le Action.

> Nota: il nodo aperto sulle eccezioni di ricorrenza (Sotto-Ciclo 2.3) va rivalutato prima di chiudere definitivamente questo Ciclo, se l'uso reale dell'app lo rende necessario.
