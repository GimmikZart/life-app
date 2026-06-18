# Ciclo 7 — Finanze (Core Feature futura)

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale e le regole valide per tutti i Sotto-Cicli.

## Avvertenza

Questo Ciclo è **esplicitamente fuori scope per la V1**, secondo il Project Knowledge v2 (sezione 3.6: "Le Finanze non fanno parte della V1 ma sono parte integrante della visione di lungo periodo del prodotto"). È incluso in questo piano per completezza e per evitare scelte architetturali nei Cicli precedenti che renderebbero difficile aggiungere le Finanze in futuro, ma **non va avviato prima che tutti i Cicli 1-6 siano completi e stabili**, salvo decisione esplicita e consapevole di anticipare la roadmap.

I sotto-cicli qui sotto sono volutamente meno dettagliati rispetto ai Cicli precedenti, perché il Project Knowledge v2 stesso descrive le Finanze solo ad alto livello (sezione 3.6: tracciamento spese/entrate, abbonamenti, debiti/crediti, split spese stile Splitwise). Quando questo Ciclo verrà effettivamente avviato, sarà necessaria una sessione di approfondimento dedicata (analoga a quella fatta per le altre Core Feature) prima di scrivere sotto-cicli con lo stesso livello di dettaglio degli altri.

---

## Sotto-Ciclo 7.1 — Schema dati Finanze (bozza)

**Obiettivo:** definire uno schema dati iniziale per spese, entrate, abbonamenti, debiti/crediti.

**Prerequisiti:** Ciclo 6 completato. Approfondimento funzionale dedicato (fuori da questo documento) prima di iniziare, per definire campi e regole non ancora specificati nel Project Knowledge.

**Scope incluso (indicativo, da affinare in fase di approfondimento):**
- Tabella `transactions` (spese ed entrate): importo, valuta, categoria, data, nota, eventuale collegamento a una Proprietà (es. spesa di manutenzione auto) o a un'Action
- Tabella `subscriptions` (abbonamenti ricorrenti): nome, importo, frequenza di rinnovo, data prossimo rinnovo
- Tabella `debts_credits`: controparte, importo, direzione (debito/credito), stato (saldato/in sospeso)
- Valutare se le Finanze, come le altre Core Feature, devono collegarsi alle Action (es. "pagare la rata" come Action ricorrente) — coerente con il principio "Action = centro dati" del Project Knowledge v2

**Scope escluso:**
- Funzionalità di split spese (stile Splitwise) — è la parte più complessa, da trattare come sotto-ciclo a parte una volta chiarito il modello dati di base

**Output atteso:**
- Schema Drizzle in bozza, da validare con una sessione di approfondimento funzionale prima dell'implementazione definitiva

**Criteri di completamento:**
- [ ] Sessione di approfondimento funzionale completata e documentata
- [ ] Schema dati validato e creato nel database

---

## Sotto-Ciclo 7.2 — CRUD Transazioni e Abbonamenti

**Obiettivo:** un utente può registrare spese, entrate e abbonamenti ricorrenti.

**Prerequisiti:** Sotto-Ciclo 7.1 completato.

**Scope incluso (indicativo):**
- CRUD transazioni con categorizzazione
- CRUD abbonamenti con promemoria di rinnovo (eventualmente generando un evento calendario o una Action, riusando l'infrastruttura esistente)
- Vista riepilogo spese/entrate per periodo

**Output atteso:** da definire in dettaglio durante l'approfondimento funzionale.

**Criteri di completamento:** da definire in dettaglio durante l'approfondimento funzionale.

---

## Sotto-Ciclo 7.3 — Debiti, Crediti e Split Spese

**Obiettivo:** gestione di debiti/crediti tra utenti e funzionalità di split spese.

**Prerequisiti:** Sotto-Ciclo 7.2 completato.

**Scope incluso (indicativo):**
- CRUD debiti/crediti con controparte (eventualmente un altro utente Life App, riusando il concetto di `relationships` già esistente dal Ciclo 2, o una controparte esterna libera)
- Split spese tra più utenti, con calcolo automatico delle quote

**Output atteso:** da definire in dettaglio durante l'approfondimento funzionale.

**Criteri di completamento:** da definire in dettaglio durante l'approfondimento funzionale.

---

## Fine del Ciclo 7

Con il completamento di questo Ciclo (in una fase futura, non nella V1), tutte le Core Feature previste dalla visione di lungo periodo di Life App sono implementate.

---

*Promemoria: prima di avviare concretamente lo sviluppo di questo Ciclo, è fortemente raccomandata una sessione di brainstorming/revisione dedicata alle Finanze, analoga a quella che ha prodotto il Project Knowledge v2 per le altre Core Feature, e un conseguente aggiornamento di questo documento con lo stesso livello di dettaglio degli altri Cicli.*
