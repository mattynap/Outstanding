---
name: engine-design
description: Decisioni di architettura del motore (Rng, GameContext, saveVersion, id, tempo)
metadata:
  type: project
---

- `Rng` = xoshiro128** seminato con splitmix32; `normal()` usa Irwin–Hall (12 uniformi) per evitare
  funzioni trascendenti che possono differire tra motori JS (V8 vs JavaScriptCore). Un test congela
  la sequenza del seme 12345: **non cambiarla** senza una migrazione dei salvataggi.
- Pattern: ogni funzione pubblica crea `Rng.fromState(state.rngState)`, lavora, e restituisce lo
  stato nuovo con `rngState: rng.getState()`. Nessuna mutazione dello stato in ingresso.
- Le funzioni pubbliche accettano `ctx: GameContext = defaultContext` (config + content) come ultimo
  parametro, così i test possono iniettare parametri diversi.
- `saveVersion` resta **1** finché il gioco non è pubblicato (nessun salvataggio reale da migrare);
  dalla prima release ogni cambio di forma richiede una migrazione in `engine/src/save/serialize.ts`.
- Tempo: settimana assoluta (`week`, 0 = inizio stagione 1), 52 settimane per stagione da
  `config/calendar.json`; età = floor((week - birthWeek) / 52).
- Lista cognomi in `content/data/names.json` curata a mano evitando cognomi di calciatori italiani
  celebri (non si può usare una blocklist: vietato scrivere nomi reali nel repo).

Collegato: [[tooling]]
