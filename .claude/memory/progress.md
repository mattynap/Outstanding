---
name: progress
description: Stato di avanzamento delle milestone e punto esatto da cui riprendere
metadata:
  type: project
---

Obiettivo concordato (2026-11-16): sviluppare M0→M4 in autonomia, commit + CHANGELOG + memoria a fine
di ogni milestone, poi **fermarsi dopo M4** per la revisione dell'utente.

## Stato al 2026-11-16 (fine sessione)

- M0–M4 completate. M3 e M4 sono committate sul branch `dev` (pushato su origin/dev).
- M4: modulo `engine/src/match/` (`selection.ts`, `moments.ts`, `match.ts`), parametri in
  `config/match.json`, testi in `content/data/i18n/it.json` (`match.*`), test in `match.test.ts`.
- Bilanciamento M4 indicativo (20 carriere, prima stagione, scelte casuali): ATT ~15 gol in
  30 partite, gol/partita ~2,8–3, media voto 5,9–6,6. Va rivisto con il simulatore in M8.
- In M4 la partita **non** modifica ancora forma, energia, morale né fiducia dell'allenatore:
  è compito di M6 (progressione).
- Come concordato, dopo M4 ci si **ferma** per la revisione dell'utente prima di M5.

## Decisioni prese dall'utente (2026-11-16)

- Coppe: decide lo sviluppatore → nuova milestone **M7b – Coppe** (dopo M7, prima del simulatore,
  così il simulatore conta anche i trofei). Annotata in CLAUDE.md.
- Settimane senza partite: restano **giocabili oppure saltabili a scelta del giocatore**
  (serve una funzione tipo "salta alla prossima partita" quando arriva planWeek in M6).
- PDF del documento di progetto: **versionato** nel repository.

Collegato: [[world-design]], [[engine-design]], [[feedback-no-permission-prompts]]
