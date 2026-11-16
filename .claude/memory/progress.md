---
name: progress
description: Stato di avanzamento delle milestone e punto esatto da cui riprendere
metadata:
  type: project
---

Obiettivo concordato (2026-11-16): sviluppare M0→M4 in autonomia, commit + CHANGELOG + memoria a fine
di ogni milestone, poi **fermarsi dopo M4** per la revisione dell'utente.

## Stato al 2026-11-16

- M0–M7 e M7b completate e pushate sul branch `dev`.
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
- Prossimo passo: M8 (simulatore), che deve contare anche i trofei (`SeasonRecord.trophies`).
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
3. M7b fatta (2026-11-16, l'utente ha chiesto di rimandare le idee a dopo M7b): ora M8, salvo
   diverse priorità dell'utente. Le idee di docs/TODO.txt restano da discutere.
- Stato git: tutto committato e pushato su `origin/dev` (main fermo a M2).

## Decisioni prese dall'utente (2026-11-16)

- Coppe: decide lo sviluppatore → nuova milestone **M7b – Coppe** (dopo M7, prima del simulatore,
  così il simulatore conta anche i trofei). Annotata in CLAUDE.md.
- Settimane senza partite: restano **giocabili oppure saltabili a scelta del giocatore**
  (serve una funzione tipo "salta alla prossima partita" quando arriva planWeek in M6).
- PDF del documento di progetto: **versionato** nel repository.

Collegato: [[world-design]], [[engine-design]], [[cups-design]], [[feedback-no-permission-prompts]]
