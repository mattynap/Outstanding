---
name: simulator-design
description: "Come funziona il simulatore (M8), punteggio di carriera e tempi di esecuzione"
metadata:
  node_type: memory
  type: project
  originSessionId: ba3e7028-a690-4902-a1e6-0b641b622f63
  modified: 2026-11-16T09:13:58.882Z
---

- "Leggenda" = fascia più alta del **punteggio di carriera** (decisione utente 2026-11-16, opzione
  consigliata). Punteggio in `engine/src/career/score.ts`, pesi per livello, trofei e fasce in
  `config/career.json`; lo stesso punteggio va mostrato nella schermata di fine carriera (M9).
- Strategie (decise da me): `cautious` = allenamento normale + riposo, opzione più probabile nei
  momenti chiave, sale di un livello alla volta, accetta prestiti e rinnovi; `aggressive` =
  allenamento intenso + mirato, opzione meno probabile, firma sempre il livello più alto, niente
  prestiti; `random` = tutto a caso. Eventi: scelta casuale per tutte. Sponsor e procuratore
  migliore: sempre accettati.
- Le scelte delle strategie usano un `Rng` separato (seme ^ costante): il gioco resta deterministico.
- Tempo di gioco stimato con `SECONDS_PER` in `simulator/src/run.ts` (ipotesi, non config di gioco).
- Velocità: ~0,7 s a carriera in un thread; il CLI usa `availableParallelism() - 1` worker
  (la macchina dell'utente ha 32 core). I worker caricano `worker.ts` grazie a tsx (execArgv ereditato).
- Output in `sim-output/` (in .gitignore). `--details` aggiunge i risultati di ogni carriera.

Collegato: [[progress]], [[cups-design]]
