---
name: progress
description: Stato di avanzamento delle milestone e punto esatto da cui riprendere
metadata:
  type: project
---

Obiettivo concordato (2026-11-16): sviluppare M0→M4 in autonomia, commit + CHANGELOG + memoria a fine
di ogni milestone, poi **fermarsi dopo M4** per la revisione dell'utente.

## Stato al 2026-11-16

- M0–M5 completate e pushate sul branch `dev`.
- M4: modulo `engine/src/match/`, parametri in `config/match.json`. Bilanciamento indicativo
  (prima stagione, scelte casuali): ATT ~15 gol in 30 partite, 2,8–3 gol a partita. Da rivedere
  con il simulatore in M8. La partita non tocca ancora forma/energia/morale/fiducia (M6).
- M5: eventi in `content/data/events/<categoria>/*.json` registrati in `content/src/eventFiles.ts`,
  testi in `i18n/it.events.json`, motore in `engine/src/events/`, config in `config/events.json`.
  Flusso settimana: `drawWeekEvents` → `resolveEvent` per ciascuno → (`playMatch`) → `advanceWeek`.
- Rimandati a milestone successive: effetto `relationship` con `target: agent` non fa nulla finché
  non c'è il procuratore (M7); `transferRequests` saranno consumate dal mercato (M7); le regole
  complete degli infortuni (rischio, ricadute) arrivano in M6.
- Prossimo passo: M6 (progressione). Contenuti: arrivare a 100 eventi in parallelo da qui in poi.

## Decisioni prese dall'utente (2026-11-16)

- Coppe: decide lo sviluppatore → nuova milestone **M7b – Coppe** (dopo M7, prima del simulatore,
  così il simulatore conta anche i trofei). Annotata in CLAUDE.md.
- Settimane senza partite: restano **giocabili oppure saltabili a scelta del giocatore**
  (serve una funzione tipo "salta alla prossima partita" quando arriva planWeek in M6).
- PDF del documento di progetto: **versionato** nel repository.

Collegato: [[world-design]], [[engine-design]], [[feedback-no-permission-prompts]]
