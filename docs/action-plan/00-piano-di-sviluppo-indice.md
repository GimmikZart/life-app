# Life App — Piano di Sviluppo (Indice)

> Questo documento è il punto di ingresso del piano di sviluppo di Life App.
> Si basa sulla v2 del Project Knowledge Document e traduce le Core Features in un percorso di sviluppo eseguibile passo per passo.
> Ogni Ciclo corrisponde a una Core Feature (o a una fase trasversale come il Setup). Ogni Ciclo è diviso in Sotto-Cicli brevi e autoconclusivi.

---

## Come è organizzato questo piano

Il piano è diviso in **documenti separati**, uno per Ciclo, per due motivi pratici:

1. **Contesto limitato per l'AI di sviluppo.** Dare in pasto a Claude Code o Codex un solo Sotto-Ciclo alla volta (con questo indice + il documento del Ciclo corrente + il Project Knowledge v2) è molto più efficace che dare tutto il piano insieme.
2. **Tracciabilità.** Puoi segnare lo stato di avanzamento ciclo per ciclo senza dover scorrere un file gigante.

### Elenco documenti

| File | Contenuto |
|---|---|
| `00-piano-di-sviluppo-indice.md` | Questo documento — overview, ordine, regole generali |
| `01-ciclo-setup.md` | Setup di progetto, infrastruttura, autenticazione |
| `02-ciclo-calendario.md` | Core Feature Calendario (incluso MVP calendario condiviso) |
| `03-ciclo-action-engine.md` | Core Feature Action Engine |
| `04-ciclo-obiettivi-skill.md` | Core Feature Obiettivi + Skill (gamification) |
| `05-ciclo-proprieta.md` | Core Feature Proprietà + sistema template |
| `06-ciclo-integrazioni-esterne.md` | Integrazione Google Calendar, Outlook, CalDAV |
| `07-ciclo-finanze.md` | Core Feature Finanze (futura, fuori scope V1) |

---

## Regole generali valide per ogni Sotto-Ciclo

Queste regole vanno rispettate in ogni Sotto-Ciclo, indipendentemente dal Ciclo a cui appartiene. Sono pensate per essere date in pasto all'AI di sviluppo insieme al Sotto-Ciclo specifico.

### Principi per l'AI che esegue lo sviluppo

1. **Un Sotto-Ciclo = una sessione di lavoro.** Ogni Sotto-Ciclo è progettato per essere completato in un singolo passaggio. Non aprire lavoro su più Sotto-Cicli contemporaneamente.
2. **Non anticipare lavoro di Sotto-Cicli futuri.** Se durante lo sviluppo emerge la tentazione di costruire qualcosa che appartiene a un Sotto-Ciclo successivo, fermarsi e segnalarlo invece di implementarlo.
3. **Rispettare lo schema dati del Project Knowledge v2.** Eventuali deviazioni vanno segnalate esplicitamente, non applicate silenziosamente.
4. **Ogni Sotto-Ciclo termina in uno stato funzionante.** Niente codice a metà che rompe la build. Se un Sotto-Ciclo introduce una feature, quella feature deve essere usabile (anche se minimale) alla fine del Sotto-Ciclo.
5. **Test minimi ma presenti.** Dove ha senso (logica di calcolo, RLS, API), scrivere almeno test essenziali che validino il comportamento descritto.
6. **Non inventare requisiti.** Se qualcosa non è specificato nel Project Knowledge o nel Sotto-Ciclo, scegliere l'opzione più semplice e segnalarla come assunzione, non come decisione definitiva.

### Struttura di ogni Sotto-Ciclo

Ogni Sotto-Ciclo nei documenti seguenti è descritto con questo schema fisso:

- **Obiettivo** — cosa deve esistere e funzionare alla fine del sotto-ciclo
- **Prerequisiti** — quali sotto-cicli precedenti devono essere già completati
- **Scope incluso** — cosa va costruito
- **Scope escluso** — cosa NON va costruito in questo sotto-ciclo (per evitare overreach)
- **Output atteso** — file, tabelle, componenti, endpoint concreti
- **Criteri di completamento** — checklist verificabile per dire "questo sotto-ciclo è finito"

---

## Ordine dei Cicli e dipendenze

```
Ciclo 1 — Setup
    │
    ▼
Ciclo 2 — Calendario  ◄── primo MVP utilizzabile
    │
    ▼
Ciclo 3 — Action Engine
    │
    ▼
Ciclo 4 — Obiettivi + Skill
    │
    ▼
Ciclo 5 — Proprietà
    │
    ▼
Ciclo 6 — Integrazioni esterne (Google/Outlook/CalDAV)
    │
    ▼
Ciclo 7 — Finanze (futuro, fuori scope V1)
```

**Perché questo ordine e non un altro:**

- Il **Setup** viene sempre prima: senza progetto inizializzato, auth e DB collegato, nessun altro ciclo può partire.
- Il **Calendario** viene subito dopo perché è il centro UX del prodotto ed è l'MVP a time-to-value più basso (vedi Project Knowledge v2, sezione 5 e 7): un utente può già ottenere valore da calendario + condivisione senza nessuna delle feature successive.
- L'**Action Engine** viene dopo il Calendario perché le Action si appoggiano già a un concetto di evento/data che il Calendario ha introdotto, ma a sua volta deve esistere prima che Obiettivi, Skill e Proprietà possano collegarsi a qualcosa.
- **Obiettivi + Skill** sono raggruppati in un solo Ciclo perché sono fortemente interdipendenti (il valore delle Skill esiste solo se ci sono Action completate, e gli Obiettivi sono "contenitori" di Action) e perché rappresentano insieme il layer di gamification.
- Le **Proprietà** arrivano dopo perché dipendono dall'Action Engine (le Action si collegano alle Proprietà) ma sono concettualmente indipendenti da Obiettivi/Skill — possono quindi slittare prima o dopo il Ciclo 4 se necessario, ma di default vengono dopo per restare fedeli alla roadmap del Project Knowledge.
- Le **Integrazioni esterne** vengono dopo perché richiedono che il modello di Calendario sia stabile (altrimenti si rischia di dover ri-progettare la sincronizzazione più volte).
- Le **Finanze** sono l'ultimo ciclo, esplicitamente fuori scope per la V1 secondo il Project Knowledge.

Questo ordine può essere riconsiderato in corsa (es. anticipare le Proprietà se serve prima per ragioni di business), ma va fatto consapevolmente, non per inerzia.

---

## Mappa dei Sotto-Cicli per Ciclo (aggiornata dopo la revisione)

Alcuni Sotto-Cicli originari sono stati scomposti in seguito a un feedback di revisione del piano (vedi "Changelog di revisione" più sotto), perché ritenuti troppo ampi per una singola sessione di sviluppo. Questa mappa riflette la numerazione attuale e va usata come riferimento, non quella eventualmente citata in versioni precedenti di questo piano.

| Ciclo | Sotto-Cicli |
|---|---|
| 1 — Setup | 1.1, 1.2, 1.3, 1.4 |
| 2 — Calendario | 2.1, 2.2, 2.3, 2.4, **2.5a, 2.5b**, 2.6 |
| 3 — Action Engine | 3.1, 3.2, 3.3, 3.4 |
| 4 — Obiettivi + Skill | 4.1, 4.2, 4.3, **4.4a, 4.4b**, **4.5a, 4.5b**, 4.6, 4.7 |
| 5 — Proprietà | 5.1, 5.2, 5.3 |
| 6 — Integrazioni esterne | 6.1, **6.2a, 6.2b**, **6.3a, 6.3b**, 6.4 |
| 7 — Finanze | 7.1, 7.2, 7.3 (dettaglio da definire, vedi documento dedicato) |

---

## Changelog di revisione

Questa sezione traccia le revisioni sostanziali fatte al piano dopo la sua prima stesura, per mantenere visibile cosa è cambiato e perché, senza dover confrontare versioni precedenti dei file.

**Revisione 1 (post feedback di Codex sul piano):**
- **Modello inviti calendario** (Ciclo 2): introdotto il campo `status` su `calendar_members` (`pending | accepted | declined`) per gestire il flusso di invito esplicito, prima assente.
- **Categoria/tag eventi** (Ciclo 2): introdotto il campo `category` (stringa libera) su `calendar_events`, necessario per supportare la regola di visibilità "tutto tranne una categoria specifica".
- **Timezone, conflitti, ownership sync esterna** (Ciclo 2 e Ciclo 6): chiarito esplicitamente che le date sono sempre salvate in UTC; definita la strategia di conflict resolution last-write-wins basata su timestamp; definita la regola di ownership dei calendari importati da provider esterni.
- **Collegamento completamento ↔ occorrenza** (Ciclo 3): introdotti `calendar_events.action_id` come foreign key attiva, e `action_completions.calendar_event_id` + `occurrence_date` con relativo unique constraint, per eliminare l'ambiguità tra streak/consistency/annullamento di un completamento.
- **Unique constraints mancanti**: aggiunti su `calendar_members`, `relationships`, `event_visibility_overrides`, `event_associations` (Ciclo 2); `action_completions`, `action_objectives`, `skill_weights`, `action_skills`, `user_badges` (Ciclo 3-4); `action_properties` (Ciclo 5); `external_calendar_connections` (Ciclo 6).
- **Natura di `skill_progress`** (Ciclo 4): chiarito esplicitamente che è una tabella di snapshot periodico, non un ledger di eventi (il ledger granulare resta `action_completions`).
- **Sotto-Cicli scomposti perché troppo ampi**: 2.5 → 2.5a (regole di visibilità) + 2.5b (overlay disponibilità); 4.4 → 4.4a (streak/consistency) + 4.4b (formula completa); 4.5 → 4.5a (level/deterioramento) + 4.5b (recupero/presentazione); 6.2 → 6.2a (import Google) + 6.2b (import Outlook); 6.3 → 6.3a (propagazione Google) + 6.3b (propagazione Outlook).
- **Nodo aperto aggiunto**: eccezioni di ricorrenza (modifica/eliminazione di una singola occorrenza di una serie ricorrente) non sono supportate nella V1; segnalato esplicitamente nel Ciclo 2 come limite consapevole, da rivalutare se necessario.

---

## Come usare questo piano in pratica

1. Apri il documento del Ciclo corrente (es. `02-ciclo-calendario.md`).
2. Fornisci all'AI di sviluppo: questo indice + il Project Knowledge v2 + il documento del Ciclo + il Sotto-Ciclo specifico su cui vuoi lavorare.
3. Lascia che l'AI completi un Sotto-Ciclo per sessione.
4. Verifica i Criteri di completamento del Sotto-Ciclo prima di passare al successivo.
5. Quando un intero Ciclo è completo, passa al documento del Ciclo successivo.

---

*Documento generato come piano di sviluppo derivato dal Project Knowledge Document v2 di Life App.*
