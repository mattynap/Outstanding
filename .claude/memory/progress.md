---
name: progress
description: Stato di avanzamento delle milestone e punto esatto da cui riprendere
metadata:
  type: project
---

Obiettivo concordato (2026-11-16): sviluppare M0→M4 in autonomia, commit + CHANGELOG + memoria a fine
di ogni milestone, poi **fermarsi dopo M4** per la revisione dell'utente.

## Stato al 2026-11-16 (sessione interrotta dall'utente, "riprendiamo tra poco")

- M0, M1, M2: completate, con commit e push su origin/main (ultimo commit M2: `682c5c9`).
- **M3 in corso, NON ancora committata.** File già scritti e funzionanti (50 test verdi, typecheck ok):
  - `packages/config/data/world.json` (+ `points`, `rosterAging`), `packages/config/data/match.json`
    (`quickSim`), schemi in `config/src/schemas.ts`, registrazione in `config/src/index.ts`.
  - `packages/engine/src/season/`: `schedule.ts` (round robin, settimane), `standings.ts`,
    `quickSim.ts`, `week.ts` (`advanceWeek`, `isSeasonOver`, `getTransferWindow`, `playerFixture`),
    `endSeason.ts` (classifiche, promozioni/retrocessioni, riassegnazione gironi per area,
    evoluzione rose, storico giocatore, rinnovo automatico temporaneo del contratto fino a M7,
    nuovo calendario).
  - `newCareer` ora costruisce il calendario della stagione 1; export aggiunti in `engine/src/index.ts`.
  - Test: `packages/engine/test/season.test.ts`.
- Da fare per chiudere M3: (facoltativo) verificare la stabilità del rating dei club su ~15 stagioni
  con uno script temporaneo dentro il repo, poi `pnpm format`, `pnpm lint`, `pnpm test`,
  CHANGELOG (sezione M3), commit `feat(engine): aggiungi calendario, classifiche e fine stagione (M3)`, push.
- Poi M4 (partita): convocazione, simulazione a 6 blocchi, momenti chiave come macchina a stati
  salvabile (`GameState.currentMatch`, `beginMatch`/`decideMoment` + `playMatch(state, decide)`),
  pagella 4–10 a passi di 0,5 con "s.v." sotto i minuti minimi, commento da chiave i18n,
  statistiche stagionali; `advanceWeek` lancia errore se c'è la partita del giocatore da giocare.

## Decisioni aperte da chiedere all'utente a fine M4

- Coppe (nazionale ed europee): definite ma non giocate; in quale milestone?
- Fuori stagione: 12 settimane senza partite per stagione rendono lunga la carriera (2–4 ore
  obiettivo): valutare di comprimere le settimane senza partite.
- PDF del documento di progetto: versionarlo o ignorarlo?

Collegato: [[world-design]], [[engine-design]], [[feedback-no-permission-prompts]]
