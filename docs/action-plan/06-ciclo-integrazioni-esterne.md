# Ciclo 6 — Integrazioni Calendari Esterni

> Fa parte del Piano di Sviluppo di Life App. Vedi `00-piano-di-sviluppo-indice.md` per il contesto generale e le regole valide per tutti i Sotto-Cicli.

## Obiettivo del Ciclo

Collegare Life App a Google Calendar e Microsoft Outlook/Graph (prima versione, secondo Project Knowledge v2 sezione 3.1) con sincronizzazione bidirezionale. CalDAV (Apple iCloud, Nextcloud) è seconda fase ed è incluso come sotto-ciclo separato, da affrontare solo dopo che Google e Outlook sono stabili.

> Nota di revisione: in seguito a un feedback di revisione, questo Ciclo è stato rivisto su tre fronti: (1) i precedenti Sotto-Cicli 6.2 e 6.3, che trattavano Google e Outlook insieme, sono stati separati per provider (6.2a/6.2b per l'importazione, 6.3a/6.3b per la propagazione in uscita), perché due provider con API e modelli di webhook diversi sono difficilmente gestibili in una singola sessione di sviluppo; (2) sono state chiarite esplicitamente le decisioni su timezone, gestione conflitti e ownership dei calendari importati, segnalate come mancanti in fase di revisione; (3) la numerazione di CalDAV è stata aggiornata a 6.4.

**Prerequisiti generali del Ciclo:** Ciclo 2 (Calendario) completato e stabile. È fortemente consigliato che anche i Cicli 3, 4, 5 siano completi, perché qualsiasi instabilità nel modello `calendar_events` si propagherebbe nella logica di sync — ma non è uno stretto blocco tecnico se si decide di anticipare questo Ciclo.

## Decisioni di confine valide per tutto il Ciclo

Queste decisioni erano nodi aperti segnalati in fase di revisione del piano. Vengono fissate qui una volta per tutte, perché si applicano sia a Google sia a Outlook sia, in futuro, a CalDAV.

**Timezone.** Come già stabilito nel Ciclo 2 (Sotto-Ciclo 2.3), tutte le date in Life App sono salvate in UTC. Gli eventi importati dai provider esterni arrivano tipicamente con un timezone esplicito (IANA timezone string, es. `Europe/Rome`) o con offset: la conversione a UTC va fatta al momento dell'importazione, scartando il timezone originale come informazione di storage (può essere mantenuto come metadato accessorio se comodo per il debug, ma non è la fonte di verità). In uscita, quando Life App crea/modifica un evento sul provider esterno, va inviato l'orario in UTC con timezone esplicito `UTC` (o convertito al timezone richiesto dall'API del provider, se questa non accetta UTC direttamente — verificare caso per caso nei Sotto-Cicli 6.2a/6.2b).

**Gestione conflitti.** La strategia scelta per la V1 è **last-write-wins basato su timestamp di modifica**: ogni evento sincronizzato mantiene un campo `external_updated_at` (oltre al già previsto `external_id`) che riflette l'ultimo timestamp di modifica noto sul provider esterno. Quando un'importazione (in ingresso) e una propagazione (in uscita) potrebbero teoricamente sovrapporsi sullo stesso evento, vince la versione con il timestamp di modifica più recente tra quello locale (`calendar_events.updated_at`, da aggiungere allo schema se non già presente) e quello esterno (`external_updated_at`). Non viene implementato in questo Ciclo un sistema di merge automatico dei campi in conflitto, né una UI di risoluzione conflitti manuale: è una scelta semplificata accettata consapevolmente per la V1, da rivedere se in produzione si rivela insufficiente.

**Ownership dei calendari importati.** Quando un utente collega un account Google/Outlook, gli eventi importati vengono assegnati a un calendario Life App di cui quell'utente è automaticamente `owner` (creato per l'occasione se non esiste già, vedi Sotto-Ciclo 6.2a/6.2b per il dettaglio). Questo calendario importato **non è condivisibile con altri utenti Life App tramite il normale flusso di `calendar_members`** in questo Ciclo: è un calendario di sola visualizzazione personale che rispecchia il provider esterno. Se l'utente vuole condividere con altri utenti Life App eventi che provengono da un calendario esterno, deve duplicarli manualmente su un calendario nativo Life App condivisibile (limite esplicito della V1, da segnalare in UI se si vuole evitare confusione, ma non risolverlo architetturalmente in questo Ciclo).

---

## Sotto-Ciclo 6.1 — OAuth2 e collegamento account Google/Outlook

**Obiettivo:** un utente può collegare il proprio account Google e/o Microsoft a Life App tramite OAuth2, senza ancora sincronizzare eventi.

**Prerequisiti:** Ciclo 2 completato.

**Scope incluso:**
- Flusso OAuth2 per Google Calendar API v3
- Flusso OAuth2 per Microsoft Graph API
- Storage sicuro dei token di accesso/refresh (associati all'utente, con refresh automatico quando necessario)
- UI in "Impostazioni" o "Integrazioni" per collegare/scollegare ciascun provider
- Gestione scadenza/revoca token (se un token non è più valido, l'utente viene avvisato e invitato a ricollegare l'account)

**Scope escluso:**
- Qualsiasi importazione/sincronizzazione di eventi reali (arriva nei Sotto-Cicli successivi)

**Output atteso:**
- Configurazione OAuth2 per entrambi i provider (credenziali in variabili d'ambiente)
- Tabella per memorizzare i token per utente/provider (da aggiungere allo schema, es. `external_calendar_connections: id, user_id, provider, access_token, refresh_token, expires_at`). **Unique constraint su `(user_id, provider)`**: un utente ha al massimo una connessione attiva per provider
- UI di gestione connessioni

**Criteri di completamento:**
- [ ] Un utente collega il proprio account Google con OAuth2 e il token viene salvato correttamente
- [ ] Un utente collega il proprio account Microsoft con OAuth2 e il token viene salvato correttamente
- [ ] Un utente può scollegare un account, rimuovendo i token salvati
- [ ] Il refresh dei token scaduti funziona automaticamente
- [ ] Il unique constraint su `(user_id, provider)` impedisce connessioni duplicate per lo stesso provider

---

## Sotto-Ciclo 6.2a — Importazione eventi da Google Calendar

**Obiettivo:** gli eventi esistenti su Google Calendar vengono importati come `calendar_events` in Life App, con i metadati corretti, e gli aggiornamenti successivi arrivano tramite webhook.

> Nota di revisione: questo sotto-ciclo tratta solo Google. Outlook è nel Sotto-Ciclo 6.2b, separato per isolare le differenze tra le due API (Google supporta webhook nativi per le push notification; Microsoft Graph ha un modello di sottoscrizioni diverso, da verificare in fase di implementazione se comparabile o se richiede polling).

**Prerequisiti:** Sotto-Ciclo 6.1 completato.

**Scope incluso:**
- Aggiunta allo schema `calendar_events` dei campi `external_updated_at` e, se non già presente, `updated_at` (timestamp di ultima modifica locale) — necessari per la strategia di conflitto last-write-wins decisa a livello di Ciclo
- Creazione automatica di un calendario Life App dedicato ("Google") di cui l'utente è owner, secondo la decisione di ownership presa a livello di Ciclo, se non già esistente al momento del collegamento account
- Importazione iniziale (one-time, al collegamento dell'account) degli eventi esistenti dal calendario Google, con conversione timezone → UTC secondo la decisione presa a livello di Ciclo
- Scrittura come `calendar_events` con `source = 'google'`, `external_id`, `external_updated_at` popolati
- Gli eventi importati supportano le regole di visibilità Life App esattamente come gli eventi nativi (requisito esplicito del Project Knowledge v2, sezione 3.1) — nessuna modifica richiesta al servizio `resolveEventVisibility` del Sotto-Ciclo 2.5a, dato che opera già a livello di `calendar_events` indipendentemente dalla sorgente
- Aggiornamenti in ingresso successivi tramite webhook (Google Calendar push notifications)

**Scope escluso:**
- Outlook (Sotto-Ciclo 6.2b)
- Propagazione delle modifiche da Life App verso Google (Sotto-Ciclo 6.3a)

**Output atteso:**
- Servizio di importazione eventi per Google
- Endpoint/handler per i webhook Google
- Eventi importati visibili in tutte le viste calendario esistenti, con le regole di visibilità applicate

**Criteri di completamento:**
- [ ] Gli eventi esistenti su Google Calendar vengono importati correttamente alla prima connessione, con orari convertiti correttamente in UTC
- [ ] Una modifica fatta sul calendario esterno (es. direttamente su Google Calendar) si riflette in Life App entro un tempo ragionevole tramite webhook
- [ ] Gli eventi importati rispettano le regole di visibilità configurate dall'utente
- [ ] Il calendario "Google" creato automaticamente ha l'utente come owner ed è coerente con la decisione di ownership presa a livello di Ciclo

---

## Sotto-Ciclo 6.2b — Importazione eventi da Outlook

**Obiettivo:** gli eventi esistenti su Outlook vengono importati come `calendar_events` in Life App, con la stessa logica del Sotto-Ciclo 6.2a adattata a Microsoft Graph API.

**Prerequisiti:** Sotto-Ciclo 6.2a completato (per riusare l'infrastruttura comune: campi schema, servizio di conversione timezone, integrazione con `resolveEventVisibility`).

**Scope incluso:**
- Creazione automatica di un calendario Life App dedicato ("Outlook") di cui l'utente è owner, stessa logica del Sotto-Ciclo 6.2a
- Importazione iniziale degli eventi esistenti da Outlook, con conversione timezone → UTC
- Scrittura come `calendar_events` con `source = 'outlook'`, `external_id`, `external_updated_at` popolati
- Aggiornamenti in ingresso successivi: valutare in fase di implementazione se Microsoft Graph supporta un meccanismo di sottoscrizione/webhook comparabile a Google; se la complessità risulta significativamente maggiore, ricorrere a **polling periodico** come previsto dal Project Knowledge v2 (sezione 3.1: "gli aggiornamenti in ingresso arrivano tramite webhook (Google) o polling periodico"). La scelta finale va documentata esplicitamente nel codice

**Scope escluso:**
- Propagazione delle modifiche da Life App verso Outlook (Sotto-Ciclo 6.3b)

**Output atteso:**
- Servizio di importazione eventi per Outlook
- Meccanismo di aggiornamento in ingresso (webhook o polling, secondo la scelta documentata)
- Eventi importati visibili in tutte le viste calendario esistenti, con le regole di visibilità applicate

**Criteri di completamento:**
- [ ] Gli eventi esistenti su Outlook vengono importati correttamente alla prima connessione, con orari convertiti correttamente in UTC
- [ ] Una modifica fatta sul calendario esterno si riflette in Life App entro un tempo ragionevole
- [ ] Gli eventi importati rispettano le regole di visibilità configurate dall'utente
- [ ] Il calendario "Outlook" creato automaticamente ha l'utente come owner

---

## Sotto-Ciclo 6.3a — Propagazione modifiche in uscita verso Google

**Obiettivo:** le modifiche fatte su un evento importato da Google (o la creazione di un nuovo evento su un calendario Life App collegato a Google) vengono propagate a Google Calendar.

**Prerequisiti:** Sotto-Ciclo 6.2a completato.

**Scope incluso:**
- Quando un utente modifica/elimina un evento Life App con `source = 'google'`, la modifica viene propagata via API a Google Calendar, aggiornando `external_updated_at` al termine della chiamata
- Quando un utente crea un nuovo evento sul calendario "Google" (quello creato nel Sotto-Ciclo 6.2a), l'evento viene anche creato su Google Calendar (con popolamento di `external_id` al ritorno della chiamata API)
- Applicazione della strategia di conflitto last-write-wins decisa a livello di Ciclo: prima di propagare una modifica, confrontare `calendar_events.updated_at` locale con `external_updated_at`; se l'esterno è più recente (es. modificato nel frattempo da un webhook non ancora processato), recuperare prima l'ultima versione esterna invece di sovrascriverla ciecamente
- Gestione errori: se la propagazione fallisce (es. token scaduto, rate limit), l'evento resta valido in Life App e viene segnalato come "non sincronizzato", con un meccanismo di retry

**Scope escluso:**
- Outlook (Sotto-Ciclo 6.3b)
- CalDAV (Sotto-Ciclo 6.4)

**Output atteso:**
- Servizio di propagazione modifiche per Google
- Indicatore UI di stato sincronizzazione su un evento ("sincronizzato" / "in attesa" / "errore")
- Meccanismo di retry per propagazioni fallite

**Criteri di completamento:**
- [ ] Una modifica a un evento importato da Google si riflette su Google Calendar
- [ ] Un nuovo evento creato sul calendario "Google" viene creato anche su Google Calendar
- [ ] La strategia last-write-wins è applicata correttamente in caso di conflitto simulato (verificabile con un test che modifica lo stesso evento sia localmente sia "esternamente" con timestamp diversi)
- [ ] Un fallimento di sincronizzazione è visibile all'utente e viene ritentato

---

## Sotto-Ciclo 6.3b — Propagazione modifiche in uscita verso Outlook

**Obiettivo:** stessa logica del Sotto-Ciclo 6.3a, applicata a Outlook/Microsoft Graph.

**Prerequisiti:** Sotto-Ciclo 6.2b e 6.3a completati (6.3a perché fornisce il pattern di riferimento per conflict resolution e retry, già pensato per essere riusabile).

**Scope incluso:**
- Propagazione di modifiche/eliminazioni di eventi con `source = 'outlook'` verso Microsoft Graph
- Creazione di nuovi eventi sul calendario "Outlook" propagata verso il provider esterno
- Stessa strategia di conflict resolution e gestione errori del Sotto-Ciclo 6.3a, riusando l'infrastruttura comune (indicatore di stato, retry) se già generica per provider

**Scope escluso:**
- CalDAV (Sotto-Ciclo 6.4)

**Output atteso:**
- Servizio di propagazione modifiche per Outlook

**Criteri di completamento:**
- [ ] Una modifica a un evento importato da Outlook si riflette su Outlook
- [ ] Un nuovo evento creato sul calendario "Outlook" viene creato anche sul provider esterno
- [ ] La strategia last-write-wins è applicata correttamente anche per questo provider
- [ ] Un fallimento di sincronizzazione è visibile all'utente e viene ritentato

---

## Sotto-Ciclo 6.4 — CalDAV (seconda fase: Apple iCloud, Nextcloud)

**Obiettivo:** estendere l'integrazione a provider CalDAV generici, secondo la roadmap del Project Knowledge v2 (sezione 3.1, "seconda fase").

**Prerequisiti:** Sotto-Cicli 6.1, 6.2a, 6.2b, 6.3a, 6.3b completati e stabili in produzione (questo sotto-ciclo è esplicitamente "seconda fase" e va affrontato solo dopo che Google/Outlook funzionano senza problemi rilevanti).

**Scope incluso:**
- Configurazione di un client CalDAV generico
- Flusso di collegamento account CalDAV (credenziali specifiche del protocollo, diverse da OAuth2 — tipicamente URL del server + credenziali utente)
- Creazione automatica di un calendario Life App dedicato ("CalDAV" o con nome specifico del provider), stessa logica di ownership degli altri provider
- Importazione e sincronizzazione bidirezionale eventi, riusando l'architettura già costruita nei Sotto-Cicli 6.2a/6.2b/6.3a/6.3b quanto più possibile (stesso modello `calendar_events` con `source = 'caldav'`, stessa strategia di conflict resolution)

**Scope escluso:**
- Nessuna funzionalità del Calendario Life App oltre alla sincronizzazione (le regole di visibilità, le viste, ecc. sono già generiche e non richiedono modifiche)

**Output atteso:**
- Servizio di integrazione CalDAV
- UI di collegamento account CalDAV

**Criteri di completamento:**
- [ ] Un utente collega un account CalDAV (es. iCloud o Nextcloud) fornendo le credenziali richieste
- [ ] Gli eventi vengono importati e sincronizzati bidirezionalmente come per Google/Outlook
- [ ] Gli eventi CalDAV rispettano le stesse regole di visibilità degli altri eventi

---

## Fine del Ciclo 6

Al termine di questo Ciclo: Life App è completamente integrata con i principali provider di calendario (Google, Outlook, e CalDAV come seconda fase), con decisioni esplicite su timezone, conflitti e ownership applicate in modo coerente a tutti i provider. Tutte le Core Feature della V1 più questa estensione sono complete. Resta il Ciclo 7 — Finanze, esplicitamente fuori scope per la V1 (`07-ciclo-finanze.md`).
