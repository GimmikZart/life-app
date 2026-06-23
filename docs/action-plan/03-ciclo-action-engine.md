# Ciclo 3 — Action (rivisto: l'evento È l'azione)

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale.

## ⚠️ Revisione del modello (2026-06)

La prima stesura di questo ciclo descriveva un **"Action Engine"** con una tabella
`actions` separata (peso, frequenza, template) e un **motore che generava eventi
a calendario** dalle Action. È stato implementato (sotto-cicli 3.1–3.4) e poi
**revertato** (commit di revert dopo `2d17e8f`), perché il modello era sbagliato:

- duplicava la **ricorrenza nativa** che gli eventi hanno già (RRULE);
- rendeva gli eventi generati **local-only**, non sincronizzabili con Google/Microsoft;
- trattava le Action come entità astratte slegate dagli eventi.

**Modello corretto (deciso dall'utente):**

> Non esistono Action separate. Esistono gli **eventi del calendario** (e, in
> futuro, i **Todo**). Un evento **diventa un'Action** quando viene associato a
> una o più **Skill** e/o uno o più **Obiettivi**. Quando l'evento viene **svolto**
> (resta a calendario e viene segnato completato), assegna punti alle Skill e fa
> avanzare gli Obiettivi collegati. Gli eventi restano sempre eventi normali →
> **sempre sincronizzabili** con Google/Microsoft, ricorrenza nativa inclusa.

Vedi Project Knowledge v2 §3.2 e §4 (aggiornati).

## Conseguenza sul piano

Il "cuore" di questo ciclo (associare eventi a Skill/Obiettivi, completarli,
assegnare punti) **dipende da entità che non esistono ancora**: `skills` e
`objectives`. Quindi non c'è un Action Engine autonomo da costruire qui: il
lavoro reale si sposta dove quelle entità nascono.

- **Ciclo 4 (Obiettivi + Skill)** crea: `objectives`, `skills`, `skill_weights`,
  i ponti **`event_objectives`** ed **`event_skills`** (con `contribution_weight`,
  `type`), il log **`event_completions`** (per-occorrenza: `calendar_event_id` +
  `occurrence_date`, unique), e il calcolo punti/streak/consistency.
- **Ciclo 5 (Proprietà)** crea: `properties` e il ponte **`event_properties`**.
- **Calendario / eventi (già esistenti)**: nel form evento andranno aggiunte le
  sezioni "Obiettivi", "Skill" (e "Proprietà") e un campo **peso (1/2/3)** sugli
  eventi, più il comando "segna come svolto" su un'occorrenza. Questi pezzi UI si
  realizzano insieme ai rispettivi cicli.

## Stato attuale

- Sotto-cicli 3.1–3.4 (modello a tabella `actions`): **revertati**. Nessuna
  tabella `actions`/`action_completions` in DB; `calendar_events` resta com'era
  (la colonna placeholder `action_id` è inutilizzata e andrà rimossa o ignorata).
- Prossimo passo reale: **Ciclo 4 — Obiettivi + Skill** (`04-ciclo-obiettivi-skill.md`),
  che ora include esplicitamente le associazioni evento↔skill/obiettivo e il
  completamento delle occorrenze.

## Nodi aperti da decidere nel Ciclo 4

- **Completamento occorrenza**: `event_completions(calendar_event_id, occurrence_date)`
  con unique constraint; `occurrence_date` distingue le occorrenze di un evento
  ricorrente. Annullamento identificato da quella chiave (non da `completed_at`).
- **Eventi esterni (Google/MS)** come Action: anche un evento importato deve poter
  essere associato a Skill/Obiettivi e completato. Va confermato che le associazioni
  reggano per eventi con `source != life_app`.
- **Todo (futuro)**: quando arriveranno, serviranno associazioni/completamenti
  anche per i Todo — valutare se rendere i ponti polimorfici (event/todo) o tabelle
  parallele. Fuori scope finché i Todo non esistono.
