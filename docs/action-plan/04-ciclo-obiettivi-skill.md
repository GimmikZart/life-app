# Ciclo 4 — Obiettivi + Skill

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale e le regole valide per tutti i Sotto-Cicli.

> ⚠️ **Nota modello (revisione 2026-06).** Un'Action non è un'entità separata: è un **evento del calendario** (o, in futuro, un Todo) associato a Skill/Obiettivi (vedi `03-ciclo-action-engine.md`). Di conseguenza questo Ciclo possiede anche ciò che prima era nel "Ciclo 3 Action Engine":
> - tabelle ponte **`event_objectives`** ed **`event_skills`** (`contribution_weight`, `type`) — al posto di `action_objectives`/`action_skills`;
> - log completamenti **`event_completions`** (`calendar_event_id` + `occurrence_date`, unique) — al posto di `action_completions`;
> - campo **peso (1/2/3)** su `calendar_events`;
> - estensioni al **form evento** (sezioni Obiettivi/Skill) e comando **"segna come svolto"** su un'occorrenza.
> Dove sotto si legge "Action", intendere "evento (o todo) associato"; dove si legge `action_*`, usare le tabelle `event_*`.

## Obiettivo del Ciclo

Costruire le Core Feature Obiettivi e Skill (Project Knowledge v2, sezioni 3.3 e 3.4), incluso l'intero sistema di gamification: punteggio, livelli, Skill Momentum/Level, badge. Questo è il Ciclo più ricco di logica di calcolo del progetto: viene quindi diviso in sotto-cicli più granulari del solito, per mantenere ogni passaggio gestibile da un'AI in una sessione.

Include inoltre il collegamento eventi↔Skill/Obiettivi e il completamento delle occorrenze (assorbito dal vecchio Ciclo 3, vedi nota sopra).

> Nota di revisione: in seguito a un feedback di revisione del piano, i precedenti Sotto-Cicli 4.4 ("motore di calcolo punteggio") e 4.5 ("Skill Level/Momentum") sono stati ulteriormente scomposti, perché ritenuti troppo ampi per una singola sessione di sviluppo. Il calcolo punteggio è ora diviso in 4.4a (streak e consistency) e 4.4b (formula completa e scrittura). Skill Level/Momentum è diviso in 4.5a (livello e deterioramento) e 4.5b (recupero e presentazione). La numerazione dei sotto-cicli successivi (livelli, badge) è stata aggiornata di conseguenza.

**Prerequisiti generali del Ciclo:** Ciclo 1 e 2 completati (Calendario/eventi funzionanti). Il Ciclo 3 non lascia tabelle proprie (modello rivisto): le associazioni e il completamento si costruiscono qui, agganciati agli eventi.

---

## Sotto-Ciclo 4.1 — Schema dati Obiettivi e Skill

**Obiettivo:** avere nel database tutte le tabelle di Obiettivi e Skill, incluse le tabelle ponte verso le Action, con i vincoli di unicità necessari a evitare duplicati.

**Prerequisiti:** Ciclo 3 completato.

**Scope incluso:**
- Tabella `objectives` (`id, user_id, title, description, target_date nullable`)
- Tabella `action_objectives` (tabella ponte N:N, `action_id, objective_id`) — qui viene effettivamente creata, come deciso nel Sotto-Ciclo 3.1. **Unique constraint su `(action_id, objective_id)`**: lo stesso collegamento non può essere duplicato
- Tabella `skills` (`id, user_id, name, parent_skill_id nullable, decay_coefficient`) — il campo `decay_coefficient` viene introdotto già in questo sotto-ciclo (anticipato rispetto al Sotto-Ciclo 4.5a dove verrà effettivamente usato) per evitare una migrazione aggiuntiva in seguito; il suo utilizzo nel calcolo del deterioramento è descritto nel Sotto-Ciclo 4.5a
- Tabella `skill_weights` (`parent_skill_id, child_skill_id, weight 0-100`). **Unique constraint su `(parent_skill_id, child_skill_id)`**
- Tabella `action_skills` (tabella ponte N:N con parametri, `action_id, skill_id, contribution_weight 0-100, type primary|secondary`). **Unique constraint su `(action_id, skill_id)`**: una Action non può collegarsi due volte alla stessa Skill (se deve contribuire in più modi, si gestisce modificando la riga esistente, non duplicandola)
- Tabella `skill_progress` — **decisione presa in questa revisione sulla natura della tabella:** `skill_progress` è una tabella di **snapshot periodico**, non un ledger di eventi. Il ledger di eventi esiste già ed è `action_completions` (ogni completamento, con il proprio `points_awarded`, è la fonte di verità granulare). `skill_progress` esiste per rispondere efficientemente a "qual era il Livello/Momentum di questa Skill in un certo momento storico" senza dover ricalcolare da zero scorrendo tutti i completamenti, e per alimentare grafici di andamento nel tempo. Schema: `id, skill_id, user_id, skill_level, skill_momentum, recorded_at`, con uno snapshot scritto a ogni variazione effettiva di Level o Momentum (non a intervalli fissi arbitrari) — la cadenza esatta di scrittura è definita nel Sotto-Ciclo 4.4b (quando Level/Momentum vengono aggiornati) e nel Sotto-Ciclo 4.5a/4.5b (deterioramento/recupero)
- Tabella `badges` (`id, key, name, description, icon, criteria JSON`)
- Tabella `user_badges` (`user_id, badge_id, earned_at`). **Unique constraint su `(user_id, badge_id)`**: un badge non può essere assegnato due volte allo stesso utente — questo vincolo è anche il modo più robusto di garantire l'idempotenza della logica di assegnazione badge del Sotto-Ciclo 4.7, più sicuro di un controllo applicativo "verifica se esiste già prima di inserire"
- RLS: un utente vede/modifica solo i propri Obiettivi, Skill, progressi, badge ottenuti (la tabella `badges` con la definizione dei badge è invece leggibile da tutti, dato che è un catalogo condiviso, non dato utente)

**Scope escluso:**
- Logica applicativa, calcolo punti, UI

**Output atteso:**
- File di schema Drizzle per tutte le tabelle elencate, con i unique constraint specificati
- Migrazione eseguibile
- Seed dei badge descritti nel Project Knowledge v2 (sezione 3.4): Fuoco Sacro, Alba Produttiva, Resiliente, Equilibrista, Cecchino, Costruttore, Connesso — inseriti come righe in `badges` con il loro `criteria` JSON

**Criteri di completamento:**
- [ ] Tutte le tabelle elencate esistono, inclusi i campi `decay_coefficient` su `skills`
- [ ] Tutti i unique constraint elencati sono attivi e verificati
- [ ] I 7 badge di base sono presenti come seed in `badges`
- [ ] RLS configurate correttamente

---

## Sotto-Ciclo 4.2 — CRUD Obiettivi e collegamento con Action

**Obiettivo:** un utente può creare Obiettivi e collegarci una o più Action esistenti.

**Prerequisiti:** Sotto-Ciclo 4.1 completato.

**Scope incluso:**
- API/endpoint CRUD per `objectives`
- UI per creare un Obiettivo (titolo, descrizione, data target opzionale)
- UI per collegare/scollegare una o più Action a un Obiettivo (popolando `action_objectives`) — questo significa anche aggiornare il form della Action (creato nel Sotto-Ciclo 3.2) per aggiungere la sezione "Obiettivi collegati", ora che la tabella ponte esiste
- Vista di un Obiettivo che mostra la lista delle Action collegate e il loro stato (completata/non completata per le occorrenze recenti)
- Calcolo semplice di "progresso obiettivo" basato sul completamento delle Action collegate (percentuale di occorrenze completate in un periodo, o simile — il Project Knowledge non specifica una formula esatta per il progresso dell'obiettivo in sé, quindi va scelta l'opzione più semplice e coerente con "il progresso verso l'obiettivo si misura dal completamento delle sue Action" come da sezione 3.3)

**Scope escluso:**
- Qualsiasi logica di Skill o punteggio
- Dashboard avanzate

**Output atteso:**
- Endpoint CRUD per `objectives` e gestione `action_objectives`
- Pagina "I miei Obiettivi" con dettaglio per singolo obiettivo
- Form Action aggiornato con sezione "Obiettivi collegati"

**Criteri di completamento:**
- [ ] Un utente crea un Obiettivo
- [ ] Un utente collega una o più Action esistenti a un Obiettivo (e il collegamento è visibile da entrambi i lati: dall'Obiettivo e dall'Action)
- [ ] Una Action può appartenere a più Obiettivi contemporaneamente
- [ ] Il progresso dell'Obiettivo è calcolato e visibile

---

## Sotto-Ciclo 4.3 — Gerarchia Skill e collegamento con Action

**Obiettivo:** un utente può creare Skill organizzate in gerarchia macro/sub-skill con pesi, e collegarle alle Action.

**Prerequisiti:** Sotto-Ciclo 4.1 completato (può procedere in parallelo concettuale al 4.2, ma va comunque fatto come sessione separata).

**Scope incluso:**
- API/endpoint CRUD per `skills` (inclusa gestione `parent_skill_id` per creare sub-skill)
- API/endpoint per gestire `skill_weights`, con distribuzione di default automatica (100 / numero di sub-skill) quando si aggiunge una sub-skill, e possibilità per l'utente di modificare i pesi manualmente (con validazione che la somma dei pesi delle sub-skill di una macro-skill sia 100)
- UI per creare una macro-skill, aggiungere sub-skill, modificare i pesi
- UI per collegare una Action a una o più Skill, specificando per ciascuna il `contribution_weight` (0-100) e il `type` (`primary`/`secondary`) — questo aggiorna ulteriormente il form della Action con la sezione "Skill alimentate"

**Scope escluso:**
- Calcolo punti effettivo (arriva nel Sotto-Ciclo 4.4a/4.4b)
- Skill Level / Skill Momentum (arrivano nel Sotto-Ciclo 4.5a/4.5b)

**Output atteso:**
- Endpoint CRUD per `skills`, `skill_weights`, `action_skills`
- Pagina "Le mie Skill" con vista gerarchica (macro-skill ed elenco sub-skill con pesi)
- Form Action aggiornato con sezione "Skill alimentate"

**Criteri di completamento:**
- [ ] Un utente crea una macro-skill e relative sub-skill
- [ ] I pesi di default sono distribuiti equamente e sono modificabili dall'utente, con validazione somma = 100
- [ ] Una Action viene collegata a una o più Skill con peso e tipo (primary/secondary)

---

## Sotto-Ciclo 4.4a — Calcolo streak e consistency score

**Obiettivo:** implementare, in isolamento e con test propri, le due componenti di calcolo che dipendono dallo storico dei completamenti (streak multiplier e consistency score), prima di comporle nella formula completa.

> Nota di revisione: questo sotto-ciclo nasce dalla scomposizione del precedente Sotto-Ciclo 4.4, per isolare la parte di calcolo che dipende dall'analisi storica di `action_completions` (più delicata da testare) dalla parte di composizione finale della formula (Sotto-Ciclo 4.4b).

**Prerequisiti:** Sotto-Ciclo 4.3 completato, Sotto-Ciclo 3.4 completato (serve `action_completions` funzionante con `occurrence_date`).

**Scope incluso:**
- Funzione di calcolo dello **streak**: numero di occorrenze consecutive completate senza interruzioni, contando a ritroso da `occurrence_date` più recente. La nozione di "consecutivo" si basa sulla frequenza pianificata della Action (es. per una Action giornaliera, consecutivo significa giorno dopo giorno; per una settimanale, settimana dopo settimana) — usare `occurrence_date` come riferimento, non `completed_at`, dato che un completamento può essere segnato in ritardo
- Funzione di calcolo del **consistency score**: percentuale di completamento delle ultime 4 occorrenze pianificate per quella Action (4/4=1.2x, 3/4=1.0x, 2/4=0.8x, 1/4=0.6x) — richiede di conoscere non solo le occorrenze completate ma anche quelle pianificate e non completate, quindi questa funzione deve incrociare `action_completions` con le occorrenze generate (`calendar_events` con `action_id` non nullo, vedi Sotto-Ciclo 3.3)
- Streak multiplier finale: `1 + log(streak + 1) × 0.3`
- Entrambe le funzioni vanno scritte come funzioni pure (input: storico completamenti e occorrenze pianificate di una Action; output: numero), per essere testabili senza dipendenze da database o tempo reale

**Scope escluso:**
- Peso base e type multiplier (Sotto-Ciclo 4.4b)
- Scrittura di `points_awarded` e aggiornamento di `skill_progress` (Sotto-Ciclo 4.4b)

**Output atteso:**
- Modulo `streak.ts` (o equivalente) con la funzione di calcolo streak e streak multiplier
- Modulo `consistency.ts` (o equivalente) con la funzione di calcolo consistency score
- Test unitari con casi noti: streak 0, streak 1, streak alto (verifica andamento logaritmico); consistency 4/4, 3/4, 2/4, 1/4, e caso con meno di 4 occorrenze storiche disponibili (Action appena creata)

**Criteri di completamento:**
- [ ] Lo streak è calcolato correttamente basandosi su `occurrence_date`, non su `completed_at`
- [ ] Il consistency score gestisce correttamente il caso di una Action con meno di 4 occorrenze passate
- [ ] Entrambe le funzioni sono pure e testate unitariamente con i casi noti del Project Knowledge v2

---

## Sotto-Ciclo 4.4b — Formula di punteggio completa e scrittura su DB

**Obiettivo:** comporre la formula di punteggio completa usando i moduli del Sotto-Ciclo 4.4a, farla scattare al completamento di una Action, e scrivere i risultati su `action_completions` e `skill_progress`.

**Prerequisiti:** Sotto-Ciclo 4.4a completato.

**Scope incluso:**
- Implementazione della formula completa:
  - `punti_action = peso_base × streak_multiplier × consistency_score × type_multiplier`
  - `punti_subskill = Σ(punti_action × contribution_weight)`
  - `punti_macroskill = Σ(punti_subskill × peso_subskill / 100)`
- Type multiplier: `primary` → 1.0x, `secondary` → 0.6x
- Al completamento di una Action (evento generato dal Sotto-Ciclo 3.4), il motore: calcola `punti_action` usando streak/consistency dal Sotto-Ciclo 4.4a; distribuisce i punti tra tutte le Skill collegate alla Action secondo `action_skills`; scrive il breakdown in `action_completions.points_awarded`; aggiorna il valore accumulato della Skill (per ora un semplice accumulo di punti grezzi — la distinzione Level/Momentum è del Sotto-Ciclo 4.5a) e scrive un nuovo snapshot in `skill_progress`
- Feedback all'utente nel formato descritto: `+24 pt Danza > Popping 🔥 Streak 5` (l'utente non vede mai le formule, solo il risultato)

**Scope escluso:**
- Skill Level / Skill Momentum come valori distinti con deterioramento (Sotto-Ciclo 4.5a) — in questo sotto-ciclo l'accumulo punti può essere un singolo valore crescente; la distinzione Level/Momentum è logica aggiuntiva del prossimo sotto-ciclo, che leggerà questo valore accumulato come base
- Livelli e curva a S (Sotto-Ciclo 4.6)
- Badge (Sotto-Ciclo 4.7)

**Output atteso:**
- Modulo/servizio di calcolo punteggio completo, che compone i moduli streak/consistency del Sotto-Ciclo 4.4a
- Test unitari sulla formula completa con almeno: caso streak 0, streak alto, consistency variabile, type primary vs secondary, distribuzione su più Skill con pesi diversi
- Integrazione nel flusso di completamento Action (Sotto-Ciclo 3.4) per scrivere `points_awarded`
- Scrittura dello snapshot in `skill_progress`
- UI di feedback post-completamento

**Criteri di completamento:**
- [ ] La formula completa è implementata e testata con casi noti, riusando i moduli del Sotto-Ciclo 4.4a
- [ ] Al completamento di una Action, i punti vengono calcolati e distribuiti correttamente tra le skill collegate secondo i pesi
- [ ] Il feedback `+N pt Skill 🔥 Streak X` viene mostrato all'utente
- [ ] Ogni variazione del punteggio di una Skill scrive un nuovo snapshot in `skill_progress`

---

## Sotto-Ciclo 4.5a — Skill Level e deterioramento del Momentum

**Obiettivo:** separare il punteggio accumulato in Skill Level (permanente) e Skill Momentum (dinamico), e implementare le prime due fasi del deterioramento (finestra di grazia + decadimento logaritmico) come da Project Knowledge v2 sezione 3.4.

> Nota di revisione: questo sotto-ciclo nasce dalla scomposizione del precedente Sotto-Ciclo 4.5. Il recupero del Momentum e la presentazione visiva non punitiva sono stati spostati nel Sotto-Ciclo 4.5b, per mantenere ciascun passaggio testabile in isolamento (decadimento e recupero sono logiche distinte, anche se simmetriche).

**Prerequisiti:** Sotto-Ciclo 4.4b completato.

**Scope incluso:**
- Skill Level: massimo storico raggiunto, non scende mai, aggiornato solo verso l'alto quando i punti accumulati (calcolati nel Sotto-Ciclo 4.4b) superano il valore corrente
- Skill Momentum: valore dinamico che parte allineato al Level e si deteriora secondo le prime due fasi:
  - **Fase 1 (finestra di grazia):** nessun deterioramento per un numero di giorni proporzionale alla frequenza dell'Action collegata (giornaliera → 2-3 giorni di grazia, settimanale → 10-14 giorni). Se una Skill è alimentata da più Action con frequenze diverse, la finestra di grazia di riferimento è quella dell'Action più frequente tra quelle collegate (scelta più semplice, da documentare come assunzione)
  - **Fase 2 (deterioramento logaritmico):** `momentum = floor + (momentum_picco - floor) × e^(-k × giorni_inattivi)`, con `floor` = 40-50% dello Skill Level e `k` = `skills.decay_coefficient` (campo già presente nello schema dal Sotto-Ciclo 4.1)
- **Coefficiente k:** il Project Knowledge lo segnala come nodo aperto ("Coefficiente k del deterioramento", sezione 6). Per questo sotto-ciclo, popolare `decay_coefficient` con un valore di default fisso uguale per tutte le Skill alla creazione (scegliere un valore ragionevole e documentarlo nel codice come assunzione). Il campo è già modificabile per-skill grazie allo schema, quindi una futura UI di personalizzazione non richiederà migrazioni aggiuntive — ma tale UI non è in scope qui
- Job/funzione che ricalcola il Momentum nel tempo (può essere calcolato on-demand quando la Skill viene visualizzata, oppure tramite job periodico — scegliere l'opzione più semplice da mantenere, documentandola). Ogni ricalcolo che produce una variazione effettiva scrive un nuovo snapshot in `skill_progress`, come deciso nel Sotto-Ciclo 4.1

**Scope escluso:**
- Fase 3 (recupero) e presentazione visiva (Sotto-Ciclo 4.5b)
- Livelli e curva a S (Sotto-Ciclo 4.6)
- Badge (Sotto-Ciclo 4.7)

**Output atteso:**
- Modulo di calcolo Skill Level / deterioramento Momentum (funzione pura, testabile)
- Test unitari per finestra di grazia e fase di decadimento, con casi noti (es. verifica che il Momentum non scenda durante la grazia, e che dopo N giorni di inattività si avvicini al floor)
- Campo `decay_coefficient` popolato con default alla creazione di una Skill

**Criteri di completamento:**
- [ ] Skill Level non scende mai e si aggiorna solo quando superato dal punteggio accumulato
- [ ] Skill Momentum non si deteriora durante la finestra di grazia
- [ ] Skill Momentum si deteriora secondo la curva logaritmica dopo la finestra di grazia, verificabile con test, fermandosi al floor configurato
- [ ] L'assunzione sul valore di default di `decay_coefficient` è documentata esplicitamente nel codice/commit

---

## Sotto-Ciclo 4.5b — Recupero del Momentum e presentazione visiva

**Obiettivo:** implementare la fase di recupero del Momentum quando l'utente riprende a completare Action, e la presentazione visiva non punitiva del gap Level/Momentum.

**Prerequisiti:** Sotto-Ciclo 4.5a completato.

**Scope incluso:**
- **Fase 3 (recupero):** quando l'utente completa una nuova occorrenza di una Action collegata a una Skill il cui Momentum è sotto il Level, il Momentum risale con curva più ripida della discesa (1.5x-2x la velocità di decadimento), con un delay di 1-2 giorni dal primo completamento di ripresa prima che il recupero accelerato si attivi (nel periodo di delay, il comportamento può essere equivalente a un primo passo di recupero a velocità normale — scegliere l'opzione più semplice e documentarla), fermandosi al tetto dello Skill Level
- Presentazione visiva non punitiva: il gap tra Momentum e Level va mostrato come "potenziale che aspetta di essere riattivato", non come perdita di punti (Project Knowledge v2, sezione 3.4) — UI dedicata sulla pagina di dettaglio Skill

**Scope escluso:**
- Livelli e curva a S (Sotto-Ciclo 4.6)
- Badge (Sotto-Ciclo 4.7)

**Output atteso:**
- Estensione del modulo di calcolo Momentum (Sotto-Ciclo 4.5a) con la logica di recupero
- Test unitari per la fase di recupero, inclusi: delay iniziale, velocità di risalita relativa alla discesa, comportamento al raggiungimento del tetto (Level)
- UI che mostra Level e Momentum distintamente, con framing motivante

**Criteri di completamento:**
- [ ] Il recupero del Momentum è più rapido della discesa, verificabile con test
- [ ] Il recupero si ferma esattamente al tetto del Level e non lo supera
- [ ] Il delay iniziale di ripresa è implementato e testato
- [ ] La UI presenta il gap Level/Momentum con un framing motivante, non punitivo

---

## Sotto-Ciclo 4.6 — Livelli (curva a S) e calibrazione

**Obiettivo:** implementare i 20 livelli descritti nel Project Knowledge v2 (sezione 3.4) e collegarli al punteggio Skill Level.

**Prerequisiti:** Sotto-Ciclo 4.5b completato.

**Scope incluso:**
- Tabella di soglie punti → livello, esattamente come specificato nel Project Knowledge (da Lv 1 Novizio a Lv 20 Transcendente, con le soglie indicate)
- Funzione che, dato un valore di Skill Level (punti), restituisce il livello corrente e il nome (es. "Lv 7 — Abile")
- UI che mostra il livello corrente di ogni Skill, con indicazione di quanti punti mancano al livello successivo
- Verifica di calibrazione: includere un test/commento che verifichi la calibrazione di riferimento del Project Knowledge ("un utente che va in palestra 3 volte/settimana con action di peso 2 impiega circa 4 mesi per il Lv 5") — non è necessario un test automatico complesso, ma almeno un commento esplicito che documenti se la formula attuale rispetta questa calibrazione o se è stata accettata una deviazione

**Scope escluso:**
- Badge (Sotto-Ciclo 4.7)
- Dashboard "Stato della vita" (nodo aperto, fuori scope di questo Ciclo)

**Output atteso:**
- Costante/tabella dei 20 livelli con soglie
- Funzione `getLevelForPoints(points)` (o equivalente)
- UI livello su ogni Skill

**Criteri di completamento:**
- [ ] I 20 livelli sono implementati con le soglie esatte del Project Knowledge
- [ ] La UI mostra correttamente il livello e i punti mancanti al successivo
- [ ] La calibrazione di riferimento è stata verificata e documentata (anche se solo manualmente)

---

## Sotto-Ciclo 4.7 — Badge

**Obiettivo:** implementare l'assegnazione automatica dei 7 badge descritti nel Project Knowledge v2, in modo idempotente.

**Prerequisiti:** Sotto-Ciclo 4.6 completato.

**Scope incluso:**
- Logica di verifica criteri per ciascun badge, da eseguire al momento più opportuno (es. dopo ogni completamento di Action):
  - 🔥 Fuoco Sacro — 30 giorni di streak consecutivi
  - 🌅 Alba Produttiva — 20 action completate prima delle 9:00
  - 🔄 Resiliente — riprendi una skill dopo 30+ giorni di inattività
  - ⚖️ Equilibrista — mantieni 5 skill attive contemporaneamente
  - 🎯 Cecchino — 10 action consecutive senza saltarne una
  - 🧩 Costruttore — aggiungi la prima Proprietà personalizzata (questo criterio dipende dal Ciclo 5 — Proprietà, non ancora completato a questo punto del piano: implementare la logica di verifica ora, ma il trigger effettivo da "prima Proprietà creata" andrà collegato/verificato di nuovo nel Ciclo 5)
  - 👥 Connesso — condividi il calendario con un altro utente (criterio già verificabile dal Ciclo 2: un calendario con almeno un membro diverso dall'owner con `status = 'accepted'`)
- Scrittura in `user_badges` quando un criterio viene soddisfatto, con notifica/feedback visivo all'utente. **L'idempotenza è garantita dal unique constraint `(user_id, badge_id)`** introdotto nel Sotto-Ciclo 4.1: il codice applicativo tenta sempre l'inserimento e gestisce il conflitto (badge già presente) come caso normale, non come errore, evitando race condition tra un controllo "esiste già?" e l'inserimento successivo
- UI che mostra i badge ottenuti e quelli ancora da ottenere (con descrizione, senza svelare necessariamente i criteri esatti se si vuole mantenere un effetto scoperta — scegliere l'opzione più semplice)

**Scope escluso:**
- Eventuali nuovi badge non presenti nella lista del Project Knowledge

**Output atteso:**
- Modulo di valutazione badge (funzione/servizio che riceve un evento di sistema come "Action completata" e verifica se sblocca un badge), con inserimento idempotente basato sul unique constraint
- Pagina/sezione "I miei Badge"

**Criteri di completamento:**
- [ ] Ciascuno dei 7 badge viene assegnato correttamente quando il criterio è soddisfatto (verificabile con test o scenario manuale per ciascuno, incluso "Costruttore" anche se il trigger reale arriva nel Ciclo 5)
- [ ] Un badge ottenuto è visibile in una sezione dedicata
- [ ] Un tentativo di assegnare due volte lo stesso badge allo stesso utente non genera errori applicativi né righe duplicate (verificabile a livello di unique constraint)

---

## Fine del Ciclo 4

Al termine di questo Ciclo: Obiettivi e Skill sono completamente funzionanti, con punteggio (calcolato a partire da streak e consistency testati in isolamento), Skill Level/Momentum (con decadimento e recupero testati separatamente), livelli e badge. Il layer di gamification del Project Knowledge v2 è completo. Si può procedere al Ciclo 5 — Proprietà (`05-ciclo-proprieta.md`).
