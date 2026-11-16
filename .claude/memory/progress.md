---
name: progress
description: Stato di avanzamento delle milestone e punto esatto da cui riprendere
metadata:
  type: project
---

Obiettivo concordato (2026-11-16): sviluppare M0→M4 in autonomia, commit + CHANGELOG + memoria a fine
di ogni milestone, poi **fermarsi dopo M4** per la revisione dell'utente.

## Stato al 2026-11-16

- M0–M11b (con M7b) completate e pushate sul branch `dev`.
- M4: modulo `engine/src/match/`, parametri in `config/match.json`. Bilanciamento indicativo
  (prima stagione, scelte casuali): ATT ~15 gol in 30 partite, 2,8–3 gol a partita. Da rivedere
  con il simulatore in M8. La partita non tocca ancora forma/energia/morale/fiducia (M6).
- M5: eventi in `content/data/events/<categoria>/*.json` registrati in `content/src/eventFiles.ts`,
  testi in `i18n/it.events.json`, motore in `engine/src/events/`, config in `config/events.json`.
  Flusso settimana: `drawWeekEvents` → `resolveEvent` per ciascuno → (`playMatch`) → `advanceWeek`.
- Rimandati a milestone successive: effetto `relationship` con `target: agent` non fa nulla finché
  non c'è il procuratore (M7); `transferRequests` saranno consumate dal mercato (M7); le regole
  complete degli infortuni (rischio, ricadute) arrivano in M6.
- M6: `engine/src/player/progression.ts` (crescita, declino, infortuni), `player/condition.ts`
  (dopo-partita, recupero settimanale), `season/plan.ts` (`planWeek`, `skipToNextMatch`), config in
  `config/progression.json`. Flusso settimana: `planWeek` → `drawWeekEvents`/`resolveEvent` →
  `playMatch` → `advanceWeek` (planWeek facoltativo: senza piano non si cresce).
- Taratura M6 (8 carriere, 20 stagioni, piano allenamento+riposo): OVR medio 45 a 17 anni, 72 a 25,
  picco 74 fino a 31, 68 a 36; ~8 infortuni a carriera. Con allenamento intenso+normale si arriva al
  potenziale ~2 anni prima ma ~40 infortuni a carriera: compromesso voluto, da rivedere in M8.
- Ritiro (decisione utente 2026-11-16, opzione 2): **decide il mercato**. Ritiro automatico quando
  nessun club offre un contratto (dai 33 anni, a fine finestra estiva senza squadra) o a 40 anni;
  il giocatore può ritirarsi prima di sua scelta dai 33. Implementato in M7.
- M7: `engine/src/market/offers.ts` (offerte, trattative, rinnovi, prestiti, sponsor, ritiro per
  mancanza di offerte: `refreshMarket` chiamato da `advanceWeek`), `market/life.ts` (finanze,
  tenore di vita, procuratore, sponsor, `retire`, `seasonMarketTransition` chiamato da `endSeason`).
  Config in `config/economy.json`, marchi in `content/data/sponsors.json`.
- Verifica M7 (12 carriere, strategia "firma l'offerta del livello più alto"): 10/12 in massima
  serie, esordio 22–26 anni, ritiro 33–39. Da tarare in M8: i potenziali altissimi (90+) si fermano
  a ~80 (la crescita satura con `potentialGapScale`); i guadagni in carriera (3–36 milioni) dipendono
  da stipendi di massima serie fino a 60.000/settimana.
- M7b (coppe, 2026-11-16): modulo `engine/src/cups/cups.ts`, club stranieri in
  `engine/src/world/foreign.ts`, config `config/cups.json`, contenuti `content/data/foreign.json`.
  Decisioni in [[cups-design]]. Flusso settimana invariato, ma possono esserci **due partite**:
  `while (playerFixture(s)) playMatch(...)` prima di `advanceWeek`.
- M8 (simulatore, 2026-11-16): vedi [[simulator-design]]. Prima misurazione, 5000 carriere, seme 42
  (prudente / aggressiva / casuale): massima serie 70% / 70% / 3,5%; leggende 9,8% / 0% / 0%;
  ritiro 38,6 / 39,6 / 38 anni; tempo stimato ~10 h / ~10 h / ~10 h.
- Taratura fatta il 2026-11-16 (decisioni in [[simulator-design]]). Risultati prudente: massima
  serie 61%, esordio 25,5, leggende 2,7% (2,3–3,6% per ruolo), ritiro 37, media voto 6,23.
- Aperto: **tempo di gioco** ~3 h (tutte simulate) / ~6 h (giocate le importanti) / ~7 h (tutte
  giocate) contro l'obiettivo 2–4 h: da ridiscutere con l'utente (es. meno momenti nelle partite
  giocate, piano settimanale ripetuto in automatico). Strategia aggressiva peggiore (voto 5,75):
  il rischio paga solo contro avversari più deboli, coerente col design. I centrocampisti prudenti
  non segnano mai (tutte le opzioni da gol sono rischiose). Trofei europei rari (0,01 a carriera).
- M9 (app, 2026-11-16): vedi [[app-design]]. Verificata nel browser con Playwright (giro completo
  creazione → settimana → notizie → partita → pagella → tutte le schede, tema chiaro), nessun
  errore in console. Avvio: `pnpm --filter @outstanding/app start` (porta 4200).
- M10 (salvataggi, 2026-11-16): 3 slot (scelta mia, costante `SLOT_COUNT`), file compressi con
  fflate (~215 KB), coda di scrittura, recupero del file temporaneo, migrazione del salvataggio di
  M9. Provato nel browser (ricarica, due carriere, migrazione). `saveVersion` resta 1 fino alla
  pubblicazione (vedi [[engine-design]]).
- M11 (servizi, 2026-11-16). Decisioni utente: pubblicità a premio **nessuna per ora** (solo
  interfaccia); analytics **solo con consenso**. Acquisti: nessuna preferenza → ho scelto
  "Versione completa" (un prodotto `full_version`, entitlement `full`, toglie la pubblicità e in
  futuro sblocca gli eventi oltre i 100 della prova). **Da fare quando ci saranno 100 eventi:**
  marcare gli eventi della versione completa e filtrarli senza l'entitlement.
- M11b (editor, 2026-11-16): vedi [[editor-design]]. Provato nel browser con Playwright (club,
  persone, competizioni, esporta → annulla tutto → importa, nomi visibili in classifica).
- Prossimo passo: M12 (pubblicazione Android), salvo diverse priorità. Ancora da discutere: idee di docs/TODO.txt
  (l'utente ha aggiunto "vita reale con simulazione" e "tutorial") e tempo di gioco.
  Contenuti: arrivare a 100 eventi in parallelo.

## Idee dell'utente (docs/TODO.txt) — NON ancora pianificate

Personalizzazione del personaggio, finanze personali, investimenti con immagini, vita affettiva,
feste private, difficoltà iniziale (facile/normale/difficile), impostazione "solo testo o altro".
2026-11-16: proposta di collocazione (M9 avatar, nuova M7c "Vita privata", difficoltà tarata in
M8, solo-testo in fase 2) **non approvata**: l'utente vuole prima **integrare la lista** con altre
idee. Non inserirle in CLAUDE.md né nelle milestone finché l'utente non lo conferma.

## Da dove riprendere (sessione successiva al 2026-11-16)

1. Chiedere all'utente la lista integrata delle idee (docs/TODO.txt aggiornato) e concordare dove
   inserirle; poi aggiornare CLAUDE.md (sezione 11) e la memoria.
2. Chiedere se tenere `docs/TODO.txt` versionato (finito per errore nel commit di M7).
3. M7b e M8 fatte (2026-11-16; l'utente ha chiesto due volte di rimandare le idee). Le idee di
   docs/TODO.txt restano da discutere, insieme alla taratura del bilanciamento.
- Stato git: tutto committato e pushato su `origin/dev` (main fermo a M2).

## Decisioni prese dall'utente (2026-11-16)

- Coppe: decide lo sviluppatore → nuova milestone **M7b – Coppe** (dopo M7, prima del simulatore,
  così il simulatore conta anche i trofei). Annotata in CLAUDE.md.
- Settimane senza partite: restano **giocabili oppure saltabili a scelta del giocatore**
  (serve una funzione tipo "salta alla prossima partita" quando arriva planWeek in M6).
- PDF del documento di progetto: **versionato** nel repository.

Collegato: [[world-design]], [[engine-design]], [[cups-design]], [[feedback-no-permission-prompts]]
