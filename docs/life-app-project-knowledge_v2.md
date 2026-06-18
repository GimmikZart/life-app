# Life App — Project Knowledge Document

> Documento di contesto completo per il progetto Life App.
> Contiene tutte le decisioni architetturali, la struttura funzionale, lo schema dati e i nodi aperti emersi durante il brainstorming iniziale e le sessioni di revisione successive.
> Usare questo documento come punto di partenza per ogni nuova chat nel progetto.

---

## 1. Cos'è Life App

Life App è un'applicazione PWA (Progressive Web App) che funziona come **sistema operativo personale**. Non è una semplice app di produttività, non è un calendario, non è un tracker di abitudini. È tutte e tre le cose insieme, connesse in modo intelligente, con un sistema di gamification che trasforma il miglioramento personale in qualcosa di misurabile e motivante.

L'idea di fondo: tutto quello che fai nella tua vita — gli impegni, le routine, gli obiettivi, le relazioni, le cose che possiedi e devi gestire — ha senso solo se è connesso. Life App connette tutto questo in un unico posto, con una struttura abbastanza rigida da tenere ordine, ma abbastanza flessibile da adattarsi a qualsiasi stile di vita.

Filosofia di riferimento: **Atomic Habits** (James Clear) — se vuoi fare qualcosa, devi fisicamente pianificarla, non solo desiderarla. Ogni azione deve avere una data o frequenza pianificata.

**In una frase:** Life App è il posto dove tieni tutto quello che sei, tutto quello che hai, e tutto quello che vuoi diventare — connesso, misurabile, e sempre sott'occhio.

### Modello mentale del prodotto

Life App **non** è una piattaforma di moduli generici che l'utente assembla liberamente. Life App è composta da un insieme di **Core Features permanenti**, ognuna con UX dedicata, logica dedicata e dati dedicati, che condividono lo stesso ecosistema e comunicano tra loro attraverso le Action.

**Le Core Features sono:**
1. **Calendario** — centro dell'esperienza utente
2. **Action Engine** — centro del modello dati
3. **Obiettivi**
4. **Skill**
5. **Proprietà**
6. **Finanze** *(roadmap futura)*

Il termine "modulo" può essere usato internamente per alcune strutture dati, ma non è il modello mentale principale del prodotto.

---

## 2. Stack Tecnologico

| Layer | Tecnologia | Motivazione |
|---|---|---|
| Frontend | Vue.js 3 + Nuxt 4 | Scelta del developer, ecosistema maturo |
| Backend & DB | Supabase (PostgreSQL) | Realtime nativo, RLS per permessi, Auth integrata, scalabile |
| ORM | Drizzle ORM | Type-safe, leggero, compatibile con Supabase e ambienti edge |
| Calendario UI | FullCalendar (Vue) | Risparmia settimane di sviluppo per la prima versione |
| Integrazione calendari | Google Calendar API + Microsoft Graph API | Coprono ~80% degli utenti |
| Integrazione futura | CalDAV | Apple iCloud, Nextcloud, ecc. — seconda fase |

### Architettura dati
- **Cloud di default** (non local-first) — obbligatorio per la feature di calendario condiviso
- **Cache locale aggressiva + UI ottimistica** — l'utente non percepisce latenza, funziona in lettura anche offline
- Le scritture offline vengono sincronizzate appena torna la connessione

### Roadmap piattaforme
1. Browser PWA (versione attuale da sviluppare)
2. Porting nativo iOS e Android (fase successiva)

---

## 3. Le Core Features

### 3.1 Calendario

Il Calendario è la **Core Feature centrale** dell'app — non è opzionale, non è un modulo aggiuntivo. È il fulcro dell'esperienza utente e la prima esigenza reale che il prodotto risolve: capire quando io e altre persone siamo liberi.

#### Home della V1 — Today View

La schermata iniziale dell'app è una **Today View**, non una dashboard con Skill o statistiche. Contiene:
- Timeline della giornata corrente
- Eventi di oggi
- Action pianificate per oggi
- Disponibilità condivise con altri utenti
- Prossimi eventi in arrivo

Questa scelta garantisce che il prodotto generi valore immediato anche per un utente che non ha ancora configurato Skill, Proprietà o Obiettivi.

#### Viste disponibili

Il Calendario mostra in vista mensile, settimanale e giornaliera tutto insieme: impegni delle Proprietà, Action pianificate degli Obiettivi, eventi personali, eventi condivisi con altri utenti.

#### Integrazione calendari esterni

| Servizio | Protocollo | Stato |
|---|---|---|
| Google Calendar | Google Calendar API v3 + OAuth2 | Prima versione |
| Outlook / Microsoft | Microsoft Graph API + OAuth2 | Prima versione |
| Apple iCloud, Nextcloud, altri | CalDAV | Seconda fase |

**Come funziona l'integrazione:**
- Gli eventi importati diventano eventi Life App con metadati aggiuntivi (`source: "google"`, `external_id`)
- La sincronizzazione è bidirezionale: modifiche da Life App vengono propagate via API al calendario esterno
- Gli aggiornamenti in ingresso arrivano tramite webhook (Google) o polling periodico
- **Tutti gli eventi, inclusi quelli importati, supportano le regole di visibilità Life App**

#### Supporto multi-calendario

L'utente può creare e gestire più calendari separati all'interno di Life App:
- Personale
- Coppia
- Famiglia
- Lavoro
- Calendari personalizzati

Ogni calendario ha una propria gestione di condivisione e visibilità.

#### Sistema di condivisione e visibilità

Gli utenti possono collegarsi tra loro con un tipo di relazione definito dall'utente:

**Tipi di relazione (esempi):** Relazione, Amico, Genitore, Figlio, Fratello, Parente, Collega, Conoscente

**Ogni tipo di relazione ha regole di visibilità personalizzabili:**
- Mostra tutti gli eventi in chiaro
- Mostra solo che sei occupato (blocco unicolor, senza dettagli)
- Mostra tutto tranne una categoria specifica
- Regole granulari per ogni scenario

**Livelli di visibilità per singolo evento:**
- Visibile in chiaro (titolo, ora, luogo, dettagli)
- Visibile come "occupato" (blocco colorato senza info)
- Nascosto (non appare affatto)

**Sovrascrittura per singolo utente:** le regole del tipo di relazione sono il default, ma possono essere sovrascritte per ogni specifico contatto.

**Esempio pratico (caso d'uso principale):**
Due partner con calendari variabili condividono i rispettivi calendari. Ogni evento può essere visibile in chiaro o come semplice blocco "occupato". Sovrapposti visivamente, permettono di individuare a colpo d'occhio i buchi liberi per fare cose insieme.

**Eventi condivisi con una persona specifica:**
Un evento "Cena con Giulia" associato a un contatto specifico riceve un colore dedicato e un'icona che lo identifica a colpo d'occhio (es. rosso con cuore per la fidanzata, blu con icona persona per un amico).

---

### 3.2 Action Engine — Il Centro del Modello Dati

Le **Action** sono il vero motore del sistema. Sono l'unità fondamentale attorno a cui ruota tutta l'architettura dati.

```
Calendario  =  centro UX
Action      =  centro dati
```

Tutte le relazioni tra Obiettivi, Skill, Proprietà e Calendario passano attraverso le Action.

**Un'action può:**
- Appartenere a uno o più Obiettivi contemporaneamente
- Essere collegata a una o più Proprietà (opzionale)
- Alimentare una o più Skill (opzionale)
- Essere una routine ricorrente o un evento singolo
- Essere copiata e modificata per creare action simili (copy & paste con parametri modificabili)

**Esempio concreto:**
```
Action: "Sessione pratica Popping"
  ├── Obiettivi: "Diventare bravo nel Popping" + "Partecipare alla battle di marzo"
  ├── Proprietà collegate: (nessuna)
  ├── Skill alimentate:
  │     Danza > Popping      [primary,  peso 80%]
  │     Danza > Knowledge    [secondary, peso 20%]
  └── Frequenza: Lunedì, Mercoledì, Venerdì
```

**Esempio con più skill e proprietà:**
```
Action: "Leggo un libro sul Popping"
  ├── Obiettivi: "Diventare bravo nel Popping" + "Leggi 10 pagine al giorno"
  ├── Proprietà collegate: (nessuna)
  ├── Skill alimentate:
  │     Danza > Knowledge    [primary,  peso 40%]
  │     Lettura > Focus      [primary,  peso 30%]
  │     Lettura > Velocità   [primary,  peso 30%]
  └── Frequenza: 1 volta a settimana
```

**Configurazione di ogni Action:**
- **Nome** — libero
- **Peso** — 1 (routine leggera), 2 (impegno medio), 3 (sforzo significativo)
- **Frequenza** — giornaliera, settimanale, mensile, data specifica
- **Obiettivi collegati** — uno o più (opzionale)
- **Proprietà collegate** — una o più (opzionale)
- **Skill alimentate** — una o più, ognuna con peso % e tipo (primary/secondary)

**Importante:** il collegamento Skill–Action è configurato manualmente dall'utente sull'Action stessa. Non c'è ereditarietà automatica dall'Obiettivo. Questa scelta è stata presa deliberatamente per evitare che l'automatismo diventi più complicato da gestire della configurazione manuale, soprattutto quando l'utente vuole modificare singole action all'interno di un obiettivo.

---

### 3.3 Obiettivi

Rappresentano direzioni verso cui l'utente vuole andare — qualcosa di astratto che necessita di step concreti.

**Esempi:** Diventare bravo nel Popping, Smettere di fumare, Leggere 20 libri l'anno, Tenere la casa in ordine

**Struttura:**
- Ogni obiettivo contiene **Action** (le azioni concrete pianificate)
- Un obiettivo è essenzialmente un contenitore logico di Action — non ha logica automatica ereditata
- Il progresso verso l'obiettivo si misura dal completamento delle sue Action

**Regola fondamentale:** ogni Action deve avere una data specifica o una frequenza pianificata. Non esistono action "generiche" senza schedulazione.

---

### 3.4 Skill

Le Skill sono la rappresentazione misurabile di **chi l'utente sta diventando**. Sono completamente personalizzabili — l'utente decide nomi, gerarchia e pesi.

**Principio chiave:** le Skill sono slegate concettualmente dalle Proprietà. Il fatto di essere bravi a cucinare non è legato alla propria cucina. Il fatto di saper derapare non è legato alla propria auto. L'action che fa skillare nel drift può essere collegata all'auto come Proprietà, ma la Skill "Guida sportiva" non è collegata alla Proprietà "Auto".

**Struttura gerarchica:**
```
Macro-skill: Danza
  ├── Sub-skill: Popping    (peso 60%)
  ├── Sub-skill: Footwork   (peso 25%)
  └── Sub-skill: Knowledge  (peso 15%)
```

I pesi di default sono distribuiti equamente (100 / numero di sub-skill), ma l'utente può modificarli per riflettere l'importanza relativa che dà a ciascuna sub-skill.

#### Sistema di punteggio

Ogni Action completata genera punti calcolati con questa formula:

```
punti_action = peso_base × streak_multiplier × consistency_score × type_multiplier

punti_subskill  = Σ(punti_action × contribution_weight)
punti_macroskill = Σ(punti_subskill × peso_subskill / 100)
```

**Le tre leve del punteggio:**

| Leva | Descrizione | Calcolo |
|---|---|---|
| Peso base | Impostato dall'utente sull'action (1/2/3) | Fisso |
| Streak multiplier | Giorni/settimane consecutivi completati | `1 + log(streak + 1) × 0.3` (logaritmico, max ~2x) |
| Consistency score | Quante delle ultime 4 occorrenze hai completato | 4/4=1.2x, 3/4=1.0x, 2/4=0.8x, 1/4=0.6x |

**Type multiplier:**
- `primary` → 1.0x (l'action è fatta appositamente per quella skill)
- `secondary` → 0.6x (la skill ne beneficia come effetto collaterale)

L'utente non vede mai le formule. Vede solo il feedback: `+24 pt Danza > Popping 🔥 Streak 5`

#### I 20 Livelli (curva a S)

```
Lv 1  — Novizio           (0 - 100 pt)
Lv 2  — Apprendista       (100 - 250 pt)
Lv 3  — Praticante        (250 - 500 pt)
Lv 4  — Allievo           (500 - 900 pt)
Lv 5  — Seguace           (900 - 1.400 pt)
─────────────────────────────────────────
Lv 6  — Competente        (1.400 - 2.100 pt)
Lv 7  — Abile             (2.100 - 3.000 pt)
Lv 8  — Esperto           (3.000 - 4.200 pt)
Lv 9  — Veterano          (4.200 - 5.700 pt)
Lv 10 — Maestro           (5.700 - 7.500 pt)
─────────────────────────────────────────
Lv 11 — Maestro II        (7.500 - 9.800 pt)
Lv 12 — Maestro III       (9.800 - 12.600 pt)
Lv 13 — Gran Maestro      (12.600 - 16.000 pt)
Lv 14 — Gran Maestro II   (16.000 - 20.000 pt)
Lv 15 — Gran Maestro III  (20.000 - 25.000 pt)
─────────────────────────────────────────
Lv 16 — Leggenda          (25.000 - 32.000 pt)
Lv 17 — Leggenda II       (32.000 - 40.000 pt)
Lv 18 — Leggenda III      (40.000 - 50.000 pt)
Lv 19 — Icona             (50.000 - 65.000 pt)
Lv 20 — Transcendente     (65.000+ pt)
```

Calibrazione realistica: un utente che va in palestra 3 volte/settimana con action di peso 2 impiega circa 4 mesi per raggiungere il Lv 5, circa 1 anno in più per il Lv 10.

#### Skill Level vs Skill Momentum

Ogni Skill ha **due valori distinti**:

**Skill Level** — permanente
- Rappresenta il massimo storico raggiunto
- Non scende mai
- È il "tetto" della competenza accumulata

**Skill Momentum** — dinamico
- Rappresenta quanto l'utente è attivo *ora* su quella Skill
- Si deteriora nel tempo se non si mantiene la pratica
- Non può superare lo Skill Level (il tetto)
- Quando scende sotto lo Skill Level, l'utente deve prima recuperare il gap prima di fare progressi reali

**Meccanismo di deterioramento:**

```
Fase 1 — Finestra di grazia
  Durata proporzionale alla frequenza pianificata delle Action:
  - Action giornaliera → grazia 2-3 giorni
  - Action settimanale → grazia 10-14 giorni
  Principio: salti una volta, nessun dramma.

Fase 2 — Deterioramento logaritmico
  momentum = floor + (momentum_picco - floor) × e^(-k × giorni_inattivi)
  - k = coefficiente modulabile (skill "fragile" vs skill "robusta")
  - floor = 40-50% dello Skill Level (non si azzera mai completamente)
  Veloce all'inizio, poi sempre più lenta.

Fase 3 — Recupero (quando si riprende)
  - Curva più ripida della discesa (1.5x-2x velocità normale)
  - Si ferma allo Skill Level — oltre quel punto, progressione normale
  - Piccolo delay di 1-2 giorni prima che il recupero si attivi
    (rispecchia la realtà: il primo giorno di ripresa è sempre il più duro)
```

**Presentazione visiva:** il gap tra Momentum e Level non viene mostrato come "hai perso punti" ma come "hai questo potenziale che aspetta di essere riattivato". Frame motivante, non punitivo.

#### Badge (gamification qualitativa)

Premiano comportamenti specifici che i punti puri non catturano:

- 🔥 **Fuoco Sacro** — 30 giorni di streak consecutivi
- 🌅 **Alba Produttiva** — 20 action completate prima delle 9:00
- 🔄 **Resiliente** — riprendi una skill dopo 30+ giorni di inattività
- ⚖️ **Equilibrista** — mantieni 5 skill attive contemporaneamente
- 🎯 **Cecchino** — 10 action consecutive senza saltarne una
- 🧩 **Costruttore** — aggiungi la prima Proprietà personalizzata
- 👥 **Connesso** — condividi il calendario con un altro utente

---

### 3.5 Proprietà

Le Proprietà sono una **Core Feature permanente**. Rappresentano tutto ciò che l'utente possiede o gestisce nella vita concreta. L'utente non crea genericamente un "modulo" — aggiunge una nuova Proprietà, scegliendola da un set di template o creandone una personalizzata.

**Esempi:** Casa, Auto, Corpo, Animale domestico, Bicicletta, Strumento musicale, Proprietà personalizzata

**Struttura di ogni Proprietà:**
- Informazioni statiche (campi configurabili per tipo)
- Action collegate (manutenzioni, routine, appuntamenti)
- Scadenze e promemoria specifici

**Principio guida:** la semplicità iniziale è più importante della massima flessibilità. I template abbassano la barriera d'ingresso e permettono all'utente di ottenere valore subito.

**Nota:** le Proprietà NON hanno un collegamento diretto con le Skill. Le competenze appartengono alla persona, non agli oggetti (vedi sezione 5 — Decisioni Architetturali).

#### Sistema Template

Ogni Proprietà parte da un template preconfigurato con campi e Action suggerite. L'utente può adottarlo così com'è o modificarlo.

**Template: Casa**

Campi suggeriti:
- Indirizzo
- Numero di stanze
- Metri quadri

Action suggerite:
- Pulizia bagno
- Pulizia cucina
- Manutenzioni periodiche

**Template: Auto**

Campi suggeriti:
- Targa
- Scadenza assicurazione
- Scadenza revisione
- Chilometraggio attuale

Action suggerite:
- Cambio gomme
- Tagliando
- Revisione

**Template: Corpo**

Campi suggeriti:
- Altezza
- Peso
- Circonferenze

Action suggerite:
- Allenamento
- Stretching
- Pesata periodica

**Template Personalizzato**

Configurazione completamente libera: l'utente definisce nome, campi e Action di partenza. Il nome è libero ("Auto", "Macchina", "Alfa Romeo" sono equivalenti).

---

### 3.6 Finanze *(Core Feature futura)*

Le Finanze non fanno parte della V1 ma sono parte integrante della visione di lungo periodo del prodotto. Verranno implementate come Core Feature permanente in una fase successiva.

**Funzionalità previste:**
- Tracciamento spese e entrate
- Gestione abbonamenti
- Debiti e crediti
- Funzionalità di split spese (stile Splitwise)

---

## 4. Schema Dati

```
users
  ├── id, email, name, avatar
  └── preferences (JSON)

calendars                         ← supporto multi-calendario
  ├── id, user_id, name
  ├── color
  └── type (personal | couple | family | work | custom)

calendar_members                  ← gestione condivisioni per calendario
  ├── calendar_id
  ├── user_id
  └── permission (owner | editor | viewer)

properties                        ← Core Feature Proprietà
  ├── id, user_id, name
  ├── template_type (casa | auto | corpo | custom | ...)
  └── attributes (JSON — dati statici come targa, peso, metratura)

objectives                        ← Core Feature Obiettivi
  ├── id, user_id
  ├── title, description
  └── target_date (nullable)

actions                           ← unità fondamentale, centro del modello dati
  ├── id, user_id, name
  ├── weight (1|2|3)
  ├── frequency (JSON — tipo ricorrenza)
  └── is_template (boolean)

action_objectives                 ← tabella ponte N:N
  ├── action_id
  └── objective_id

action_properties                 ← tabella ponte N:N (un'action può coinvolgere più Proprietà)
  ├── action_id
  └── property_id

skills
  ├── id, user_id, name
  └── parent_skill_id (nullable — per sub-skills)

skill_weights                     ← peso sub-skill rispetto alla macro
  ├── parent_skill_id
  ├── child_skill_id
  └── weight (0-100)

action_skills                     ← tabella ponte N:N con parametri
  ├── action_id
  ├── skill_id
  ├── contribution_weight (0-100)
  └── type (primary | secondary)

skill_progress                    ← storico progressione
  ├── id, skill_id, user_id
  ├── skill_level (permanente, solo sale)
  ├── skill_momentum (dinamico, sale e scende)
  └── recorded_at

action_completions                ← log completamenti
  ├── id, action_id, user_id
  ├── completed_at
  ├── points_awarded (JSON — breakdown per skill)
  └── notes (nullable)

calendar_events
  ├── id, user_id, calendar_id (FK → calendars)
  ├── title
  ├── start_at, end_at
  ├── is_recurring (boolean)
  ├── recurrence_rule (JSON — RRULE)
  ├── action_id (nullable — se è un'action schedulata)
  ├── source (internal | google | outlook | caldav)
  ├── external_id (nullable — ID nel calendario esterno)
  └── visibility_default (clear | busy | hidden)

relationships                     ← connessioni tra utenti
  ├── id, user_id, target_user_id
  ├── relationship_type (stringa definita dall'utente)
  └── visibility_rules (JSON — regole di visibilità per tipo)

event_visibility_overrides        ← sovrascritture per singolo evento/utente
  ├── event_id
  ├── target_user_id
  └── visibility (clear | busy | hidden)

event_associations                ← eventi associati a contatti specifici
  ├── event_id
  ├── associated_user_id
  └── display_config (JSON — colore, icona)

badges
  ├── id, key, name, description, icon
  └── criteria (JSON)

user_badges
  ├── user_id, badge_id
  └── earned_at
```

---

## 5. Decisioni Architetturali Prese

Questa sezione documenta le scelte fatte e il perché, per non rimetterle in discussione senza motivo.

### ✅ Calendario come centro UX
**Perché:** la prima esigenza reale che il prodotto risolve è "capire quando io e altre persone siamo liberi". Il Calendario genera valore immediato anche senza Skill, Proprietà o Obiettivi configurati. Renderlo il centro dell'esperienza riduce il time-to-value per ogni nuovo utente.

### ✅ Action come centro dati
**Perché:** tutte le relazioni tra Obiettivi, Skill, Proprietà e Calendario passano per le Action. Centralizzare il modello dati sulle Action rende il sistema coerente e prevedibile — aggiungere una nuova Core Feature significa semplicemente aggiungere nuovi tipi di collegamento alle Action esistenti.

### ✅ Home = Today View
**Perché:** mostrare la giornata in corso è immediatamente utile. Una dashboard con Skill e statistiche presuppone che l'utente abbia già configurato molto del sistema — non è adatta come primo schermo.

### ✅ Calendario condiviso come primo MVP
**Perché:** è la feature con il time-to-value più basso. Non richiede configurazione di Skill, Obiettivi o Proprietà. Risolve un problema reale e quotidiano (trovare momenti liberi comuni) ed è il differenziatore più immediato rispetto ai calendari standard.

### ✅ Proprietà come Core Feature basata su template
**Perché:** la semplicità iniziale è più importante della massima flessibilità. I template abbassano la barriera d'ingresso e guidano l'utente verso una configurazione sensata fin dal primo utilizzo. La personalizzazione è sempre possibile, ma non è il punto di partenza.

### ✅ Cloud di default (non local-first)
**Perché:** il calendario condiviso richiede un server. Fare un'architettura ibrida locale+cloud solo per il calendario avrebbe creato complessità enorme (due fonti di verità, conflitti di sync, merge di dati). Tutto su cloud con cache locale aggressiva è la scelta più sensata per questo prodotto.

### ✅ Skill slegate dalle Proprietà
**Perché:** le competenze appartengono alla persona, non agli oggetti. Saper derapare non è una caratteristica dell'auto. Questa distinzione concettuale mantiene il sistema pulito e riutilizzabile (la skill "Guida sportiva" si applica a qualsiasi auto, non solo alla tua).

### ✅ Nessuna ereditarietà automatica Obiettivo → Skill
**Perché:** l'ereditarietà automatica sembrava comoda in teoria, ma in pratica quando l'utente vuole modificare le skill di una singola action deve navigare una gerarchia di override. Configurazione manuale sull'Action, una volta sola, è più trasparente e più facile da modificare.

### ✅ Action come unità fondamentale riutilizzabile
**Perché:** le action sono mattoncini — una volta configurata, una action ricorrente non richiede più attenzione. Sono copiabili con modifica di singoli parametri. Possono stare in più obiettivi contemporaneamente senza duplicazioni.

### ✅ Relazione N:N tra Action e Proprietà
**Perché:** un'action può coinvolgere più Proprietà contemporaneamente (es. "Pulizia generale" potrebbe riguardare Casa e Auto). La relazione N:N tramite tabella ponte `action_properties` è più flessibile del singolo `property_id` senza aggiungere complessità significativa.

### ✅ Curva a S per i livelli
**Perché:** i primi livelli veloci danno soddisfazione immediata e riducono il churn iniziale. I livelli medi sfidano senza frustrare. I livelli alti sono aspirazionali e realisticamente raggiungibili solo con anni di pratica — come nella realtà.

### ✅ Skill Level permanente + Skill Momentum dinamico
**Perché:** rispecchia la realtà cognitiva e fisica. Chi ha suonato chitarra per anni non dimentica dopo 6 mesi di pausa, ma la sua "forma" si riduce. Separare i due valori permette di essere onesti (il deterioramento esiste) senza essere demotivanti (non perdi mai tutto quello che hai costruito).

### ✅ Deterioramento logaritmico con finestra di grazia
**Perché:** veloce all'inizio (senti la differenza dopo una settimana senza palestra), poi lento (non azzeri anni di lavoro). La finestra di grazia evita che un singolo giorno saltato sia percepito come un fallimento.

### ✅ Recupero più veloce della discesa
**Perché:** muscle memory e reactivation sono fenomeni reali. Chi riprende recupera più in fretta di quanto ci abbia messo la prima volta. Rendere il recupero 1.5x-2x più veloce della discesa è realistico e motivante.

---

## 6. Nodi Ancora Aperti

Questi punti non sono stati ancora decisi e richiederanno ulteriore discussione:

### 🔲 Schema dati completo e definitivo
La bozza sopra è un punto di partenza. Va validata e completata prima di iniziare lo sviluppo.

### 🔲 Coefficiente k del deterioramento
Come si imposta? È fisso per tutte le skill, o l'utente può scegliere se una skill è "fragile" (si deteriora in fretta) o "robusta" (si deteriora lentamente)? E se sì, come lo imposta senza che diventi complicato?

### 🔲 Flusso di onboarding
Il flusso consigliato è: registrazione → creazione primo calendario → creazione prime Action → invito di una persona (facoltativo). Le Skill non devono essere il centro dell'onboarding. Da definire nel dettaglio cosa vede l'utente a ogni step e come viene guidato senza essere sopraffatto dalla flessibilità del sistema.

### 🔲 Dashboard "Stato della vita"
È stata proposta una vista radar/ragnatela che mostra a colpo d'occhio lo stato di tutte le skill e l'equilibrio tra le aree della vita. Design e logica da definire. Non è la home della V1 (quella è la Today View), ma potrebbe essere accessibile come vista secondaria.

### 🔲 Weekly Review
È stata proposta una vista strutturata (ispirata a GTD) per fare il punto settimanale: cosa hai completato, quali skill sono cresciute, cosa pianifichi per la prossima settimana. Da definire se è una feature core o secondaria.

### 🔲 Gestione energia delle Action
È stata proposta la possibilità di taggare ogni action con un livello di energia richiesta (bassa/media/alta) per suggerire cosa fare in base al momento della giornata. Da valutare se è nella scope della prima versione.

### 🔲 Mini-CRM per le Relazioni
Le relazioni potrebbero andare oltre il semplice calendario condiviso: compleanni, anniversari, note su quella persona, impegni futuri condivisi. Da valutare la profondità di questa feature.

### 🔲 Sincronizzazione bidirezionale calendari esterni
L'integrazione Google Calendar / Outlook richiede gestione dei webhook in ingresso e propagazione delle modifiche in uscita. Da progettare nel dettaglio prima di implementare.

### 🔲 Dettaglio template Proprietà
I template Casa, Auto, Corpo sono definiti ad alto livello. Da specificare: quanti template offrire al lancio, se i template includono anche Action preconfigurate oltre ai campi, e come l'utente li adotta e modifica.

---

## 7. Roadmap e Priorità

### Primo MVP — Calendario condiviso

La prima feature da sviluppare è il **calendario condiviso**, con funzionalità minime:
- Creazione e gestione eventi
- Supporto ricorrenze
- Multi-calendario
- Condivisione calendari tra utenti
- Overlay disponibilità
- Regole di visibilità

**Obiettivo:** permettere a due persone di trovare rapidamente momenti liberi comuni.

### Sviluppo successivo (in ordine logico)

1. **Validare e completare lo schema dati** — è il fondamento su cui tutto si costruisce
2. **Definire il flusso di onboarding** — cosa vede l'utente la prima volta
3. **Implementare l'Action Engine** — il differenziatore principale del prodotto
4. **Aggiungere Obiettivi e Skill** — il layer di gamification e crescita personale
5. **Aggiungere le Proprietà con template** — per rendere il prodotto accessibile a chi non è un power user
6. **Integrazioni calendari esterni** — Google Calendar e Outlook
7. **Finanze** — Core Feature futura, da pianificare in una fase successiva

---

*Documento aggiornato a seguito di sessione di revisione architetturale con Claude — aggiornare man mano che emergono nuove decisioni.*
