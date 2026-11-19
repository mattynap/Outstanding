---
name: Regista della stagione, Parte B (simulatore a capitoli)
description: Decisioni stabili del task B3: ciclo a capitoli nel simulatore, misura del tempo, taratura chapterMatches
type: project
---

- Il simulatore gioca di default a capitoli (`--loop chapters`): piano a inizio capitolo, eventi e offerte agli
  stop, di persona solo le partite scelte (modalità della scelta, `--mode` ignorato), le altre simulate da
  `advanceToStop`. `--loop weeks` è il ciclo della Parte A (file con suffisso `-weeks`); `sim:criterion` resta su weeks.
- Tempo: `config.simulator.secondsPer` non si tocca; il riepilogo dà minuti a stagione e ore a carriera
  (mediana, media, p10, p90). Con `chapterMatches.max` 4: mediana 20,1 min/stagione e 7,0 h/carriera.
- `calendar.chapterMatches.max` 3 -> 4 (commit 8bf6fb8). Con 3 la mediana era 18,5 min, sotto il bersaglio.
- Cautious a capitoli esce dai guardrail A0 (gol 41,5 contro 50,1, assist 42,5 contro 61,1, trofei 0,64 contro 0,81):
  causa, le partite scelte giocate di persona (soprattutto le rapide da 1-2 passi) rendono meno di quelle simulate.
  Non è colpa del ciclo: con le scelte solo simulate i numeri tornano (gol 58,9). Il confronto con A0 va rifatto o
  la base di riferimento va ridefinita per il ciclo a capitoli.
- Non provato: `match.modes.quick` [2,2] rompe test del motore (1-2 passi per spec).

## B3b: la partita rapida conserva l'apporto

- Budget del regista uguale in ogni modalità (`match.steps` [5,7]); `match.visibleSteps` [1,2] è la quota visibile
  della rapida (derivata dalla stessa estrazione del budget: nessuna estrazione in più, rapida e sim consumano il
  Rng allo stesso modo). `match.modes` non esiste più.
- I passi nascosti si risolvono dentro `run` con `prudentMomentChoice` e qualità 0,5 (eventi `moment` con
  `auto: true`), senza leggende. `DirectorState.visibleLeft` opzionale: assente = tutti visibili (full e salvataggi
  precedenti); sim = 0. Regola in `rootVisible` (director.ts): una catena che non entra nei visibili rimasti si nasconde.
- Esito misurato (cautious, 5000, capitoli): gol 48,8, assist 54,9, trofei 0,72: assist e trofei appena sotto la
  tolleranza A0 di 10%. Tempo 19,9 min a stagione e 6,9 h a carriera. Il tempo conta solo i passi visibili.

## B4: obiettivo del capitolo

- A ogni cambio di capitolo (mai in preparazione, mai senza club) si estrae a peso un obiettivo da
  `content/data/chapter-goals.json` (25 voci, filtrate con `eventConditionsSchema`/`checkConditions`, mai lo stesso
  del capitolo precedente: `chapter.lastGoalId`). Stato nel salvataggio: `chapter.goal = { id, target, settled }`,
  nessun `baseline`: il progresso si legge da `chapter.log` (partenze, gol, assist, voti, porte inviolate,
  gol nelle partite scelte) e da `playerTable` per la classifica.
- `settleChapter` è idempotente (`goal.settled`) e gira allo stop `chapterEnd`, allo stop `seasonEnd` e in
  `endSeason`. Esito come Headline `event` con chiavi `chapterGoals.<id>.met|missed`; `SeasonReport.headlines` lo porta.
- Premi in `calendar.chapterGoals`: fiducia mister +4, morale +5; mancato solo morale -2.
- L'estrazione usa l'Rng dello stato: cambia le sequenze rispetto a prima di B4 (solo a fine capitolo).
- Taratura: gli obiettivi per i centrocampisti basati sui gol erano irraggiungibili (0,7 gol a carriera), tolti.
  Soglie ritarate perché ogni metrica fosse raggiunta in circa 40-60% dei casi; il simulatore stampa la
  percentuale per metrica ("Obiettivi raggiunti").
