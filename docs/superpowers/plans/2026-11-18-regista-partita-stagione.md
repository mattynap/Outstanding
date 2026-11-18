# Regista della partita e della stagione: piano di implementazione

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) o
> superpowers:executing-plans, un task alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** partita minuto per minuto con pressione, regista della tensione, catene e conseguenze;
stagione a capitoli con 2–3 partite scelte per capitolo. Solo motore, config, contenuti e simulatore.

**Architettura:** la partita resta riprendibile in `GameState.currentMatch`; `simulateBlock` lascia il
posto a un passo al minuto (`match/pressure.ts`), il regista (`match/director.ts`) decide quando
fermarsi, le catene sono dati in `config/data/moments.json`. La stagione aggiunge un regista
(`season/director.ts`) sopra `advanceWeek`, che continua a simulare ogni settimana.

**Stack:** TypeScript strict, pnpm workspaces, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-11-18-regista-partita-stagione-design.md` (decisioni in §8).

**Fuori da questo piano:** UI (cronaca, barra della pressione, gesti, schermate dei capitoli), che avrà
un piano a parte con la skill `frontend-design` una volta chiusa la Parte A.

## Vincoli globali

- Motore puro: vietati `Math.random()`, `Date.now()` e le API del browser; ogni estrazione con `Rng` dallo stato (`GameState.rngState`).
- Nessun numero magico: ogni costante in `packages/config/data/*.json`, validata con Zod in `packages/config/src/schemas.ts`.
- Codice in inglese, commenti in italiano, testi del giocatore in italiano via chiavi di `packages/content`.
- Nessun nome reale; nessun riferimento all'AI in commit, codice e documentazione.
- Commit Conventional Commits in italiano, su `ciro-dev`; mai commit con test rossi.
- `GameState` cambia solo con `CURRENT_SAVE_VERSION` incrementata, migrazione e test (`packages/engine/src/save/serialize.ts`). Un formato per parte del piano: **v2 copre tutta la Parte A** (A2–A10, compresi `Fixture.scout`, `MatchState.legend` e la rimozione di `plannedMinutes`), **v3 tutta la Parte B** (B1–B4). Dentro una parte non si incrementa la versione: si aggiornano la migrazione della parte e i suoi test; nessun salvataggio pubblicato esce a metà parte.
- Ogni modifica a `config/` va confrontata col simulatore rispetto alla baseline del Task A0.
- Criterio (spec §8.3): la strategia contestuale batte prudente e aggressiva sul voto medio, a parità di scelte fuori campo; la differenza fra prudente e aggressiva resta entro ±0,2; i guardrail di carriera restano entro la tolleranza della baseline.
- Gradualità: i nuovi fattori entrano con i pesi iniziali indicati (ridotti) e salgono solo nel Task A10.
- Il regista decide quando fermarsi e quale momento proporre, mai l'esito: nessun aggiustamento nascosto delle probabilità; le fasce mostrate (`chanceBand`) derivano dalla probabilità vera.
- Momenti da leggenda: solo archetipi, nessun nome, data o richiamo esplicito a gol o giocatori reali (spec §8.4).
- Gesto: `qualityMaxBonus` resta 0,10 all'avvio; tetto dello schema 0,15 (spec §8.4).
- Partita completa da 5 a 7 passi interattivi, rapida da 1 a 2; stagione di 20–30 minuti, carriera di 6–8 ore (stima del simulatore).

## Review Focus

1. **Ricaricare a metà partita, anche dentro una catena**, deve dare la stessa carriera di una partita giocata senza interruzioni (test nel Task A5 e A7).
2. **Giocatore in panchina, che entra all'85' o esce al 30'**: nessun intervento fuori dal campo, nessun crash con budget 0, al massimo 1 intervento garantito se resta in campo almeno `minMinutesForMoment` (Task A5).
3. **Salvataggio v1 con `currentMatch` a metà e `pending` aperto**: dopo la migrazione la partita si chiude con lo stesso punteggio già maturato (Task A2).
4. **Partita senza tensione (0-3 al 60')**: niente interventi forzati oltre il minimo garantito, nessun finale caldo (Task A5).
5. **Nessun doppio gol dallo stesso errore**: un `failure` con `next` verso il contropiede non applica anche `goalAgainst` (Task A7).

---

# Parte A: partita

### Task A0: baseline del simulatore

**File:**
- Crea: `reports/regista/baseline-<strategy>.json` (uno per `cautious`, `aggressive`, `random`)
- Crea: `reports/regista/README.md`

- [ ] **Passo 1:** `pnpm sim --careers 5000 --strategy all --seed 42 --out reports/regista/baseline` (la CLI scrive il JSON nella cartella `--out` e stampa la tabella); rinomina i file prodotti in `baseline-<strategy>.json`.
- [ ] **Passo 2:** nel README, la tabella con età d'esordio in massima serie, % in massima serie, gol e presenze medie, trofei, età di ritiro, % leggende, voto medio, tempo stimato. Tolleranza dei guardrail: ±10% relativo su ogni metrica (±2 punti assoluti per le percentuali sotto il 20%).
- [ ] **Passo 3:** commit `test: baseline del simulatore prima del regista`.

### Task A1: schema della config (regista, pressione, dyn, rischio, catene)

**File:**
- Crea: `packages/config/data/moments.json` (i `types` escono da `match.json > moments.types`)
- Modifica: `packages/config/data/match.json`, `packages/config/src/schemas.ts:320-400`, `packages/config/src/index.ts`
- Test: `packages/config/test/config.test.ts`

**Interfacce prodotte (tipi esportati da `@outstanding/config`):**
- `MomentOutcomeConfig` aggiunge `next?: { momentId: string; chance?: number }` ed `effects?: Partial<Record<DynKey | 'pressure', number>>`.
- `MomentOptionConfig` aggiunge `risk: 'safe' | 'balanced' | 'risky'`, `closes?: boolean` (opzione "chiudi" di una catena) e `legend?: { id: string; minTension: number; skills: Partial<Record<Skill, number>> }` (Task A7b).
- `MomentTypeConfig` aggiunge `phase: 'attack' | 'defense'`, `chainOnly?: boolean` e `affinity?: DynKey` (Task A5).
- `DynKey = 'coachTrust' | 'nerves' | 'fatigue' | 'marking'`.
- `MatchConfig` aggiunge `pressure`, `director`, `dyn`, `risk`, `stakes`, `modes`, `chanceBands`, `legends` (sotto), e `moments.qualityMaxBonus` con tetto a `0.15` (valore invariato 0,10). `blocks` e `minutesPerBlock` restano solo per `totalMinutes` (90).

Valori iniziali (ridotti, si tarano in A10):

```json
"pressure": { "decay": 0.9, "ratingPush": 0.02, "homePush": 0.01, "noise": 0.12, "goalBoost": 1.2, "dangerAt": 0.6 },
"director": {
  "threshold": 0.35, "hazard": 1.5, "pMax": 0.6, "minGap": 8, "hotFrom": 75, "hotGap": 4, "hotSlots": 2,
  "wGame": 0.6, "wStakes": 0.25, "wPress": 0.4, "timeBase": 0.25, "timeExp": 2,
  "close": { "-3": 0.1, "-2": 0.2, "-1": 1, "0": 0.8, "1": 0.7, "2": 0.2, "3": 0.1 },
  "chainMaxSteps": 3, "armLead": 1, "relaxMinutes": 4,
  "repeatPenalty": 0.5, "dynAffinity": 0.3
},
"modes": { "full": [5, 7], "quick": [1, 2], "sim": [5, 7] },
"chanceBands": { "low": 0.35, "high": 0.65 },
"legends": { "perMatch": 1, "ratingBonus": 1, "popularity": 3 },
"stakes": { "cup": 1, "derby": 0.8, "top": 0.7, "debut": 0.9, "contractExpiring": 0.5, "lowTrust": 0.4, "scout": 0.8, "keyOpponent": 0.6, "lowTrustBelow": -20, "keyOpponentGap": 5, "scoutChance": 0.08 },
"dyn": { "chanceWeight": { "coachTrust": 0.02, "nerves": -0.03, "fatigue": -0.03, "marking": -0.04 }, "min": -3, "max": 3 },
"risk": { "behindBonus": 0.03, "aheadSafeBonus": 0.02, "lateFrom": 70 }
```

- [ ] **Passo 1: test che falliscono.** `moments schema accepts next/effects/risk/phase`, `rejects next to unknown moment`, `rejects chain cycle`, `rejects chain depth > chainMaxSteps`, `rejects chainOnly type with role weights`, `qualityMaxBonus up to 0.15 accepted, 0.2 rejected`, `close table keys are integers`, `chanceBands low < high`, `closes option has no next`, `legend option must be risky`.
- [ ] **Passo 2:** `pnpm vitest run packages/config` → FAIL.
- [ ] **Passo 3:** schema in `schemas.ts`. La validazione delle catene è un `superRefine` su `matchSchema` (visita in profondità da ogni tipo non `chainOnly`). Sposta i tipi in `moments.json`; ogni opzione esistente prende `risk` da questa regola: la probabilità più alta del tipo = `safe`, la più bassa = `risky`, le altre = `balanced`; `phase` = `defense` per `gk_*` e i tipi DEF di difesa, altrimenti `attack`.
- [ ] **Passo 4:** `pnpm vitest run packages/config && pnpm test` → PASS (il test `match.test.ts:230` sul tetto 0,1 si aggiorna a 0,15).
- [ ] **Passo 5:** commit `feat(config): schema di regista, pressione, catene e rischio`.

### Task A2: MatchState v2 e migrazione dei salvataggi

**File:**
- Modifica: `packages/engine/src/types.ts:325-360`, `packages/engine/src/save/serialize.ts`
- Test: `packages/engine/test/save.test.ts` (nuovo) con un salvataggio v1 a metà partita in `packages/engine/test/fixtures/save-v1-midmatch.json`

**Interfacce prodotte:**

```ts
type MatchMode = 'full' | 'quick' | 'sim';
interface MatchDyn { coachTrust: number; nerves: number; fatigue: number; marking: number }
interface DirectorState {
  budgetStart: number; budgetLeft: number; hotLeft: number; lastAt: number | null; interventions: number;
  armed: { at: number; momentId: string } | null; // preavviso: il momento si apre ad `at`
  relaxUntil: number | null;                       // respiro dopo gol o fine catena
  lastTypes: string[];                             // ultimi tipi proposti (massimo 3)
  legendsUsed: number;
  peak: { minute: number; momentId: string; tension: number; success: boolean } | null;
  plannedMinutes?: number[];                       // solo fra A3 e A5, poi rimosso
}
interface PendingMoment { momentId: string; minute: number; textVariant: number; chain?: { rootId: string; step: number }; options: number[] } // indici delle opzioni della config disponibili, fissati all'apertura
interface MatchState {
  // invariati: fixtureId, side, opponentId, selection, minuteIn, minuteOut, score, events, pending, ratingDelta, goals, assists
  minute: number;            // sostituisce blocksDone
  mode: MatchMode;
  pressure: number;          // −1..1, positivo = spinge la squadra del giocatore
  trace: number[];           // pressione per minuto giocato, arrotondata a 2 decimali
  director: DirectorState;
  dyn: MatchDyn;
  stakes: number;            // 0..1, calcolato a beginMatch (Task A4)
  legend: { id: string; success: boolean } | null; // Task A7b, letto dal report
}
```
L'evento `moment` in `MatchEvent` aggiunge `quality: number`; nuovo evento `{ kind: 'buildup'; minute; momentId; textKey }` (preavviso, Task A5).
`plannedMinutes` vive solo sul branch fra A3 e A5: nessun salvataggio v2 esce prima di A5, quindi toglierlo non richiede una migrazione.

- [ ] **Passo 1: test.** `migrates v1 save without match`, `migrates v1 mid-match without pending: minute = blocksDone·15`, `migrates v1 mid-match with pending: minute = pending.minute, goal events after that minute removed and score recomputed from the remaining ones`, `budgetLeft = momentMinutes.length (the pending moment is already spent)`, `pressure 0, trace [], dyn zero, pending kept`, `serialize→deserialize v2 is identity`, `rejects CURRENT_SAVE_VERSION + 1`.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** `CURRENT_SAVE_VERSION = 2`, `migrations[1]`. Regola del budget per tutto il piano: `budgetLeft` scende quando si **apre** un `pending` (anche un passo di catena), quindi il momento in attesa è già speso. In v1 i gol di un blocco sono estratti prima dei suoi momenti: con `pending` aperto, i gol dopo `pending.minute` non sono ancora avvenuti e la migrazione li toglie (verranno risimulati al minuto). La migrazione mette `mode: 'full'`, `stakes: 0`, `hotLeft: 0`, `lastAt: null`, `interventions: 0`, `armed: null`, `relaxUntil: null`, `lastTypes: []`, `legendsUsed: 0`, `peak: null`, `legend: null`, `budgetStart = budgetLeft` (più 1 se c'è un `pending`), `pending.options = [0..n−1]`; elimina `blocksDone` e `momentMinutes`.
- [ ] **Passo 4:** `pnpm vitest run packages/engine/test/save.test.ts` → PASS; `pnpm typecheck` mostra gli errori in `match.ts`, che si chiudono nel Task A3 (task A2 e A3 vanno in un unico commit se il typecheck non passa da solo; in alternativa i campi nuovi restano opzionali fino ad A3).
- [ ] **Passo 5:** commit `feat(engine): stato della partita v2 e migrazione dei salvataggi`.

### Task A3: simulazione al minuto guidata dalla pressione

**File:**
- Crea: `packages/engine/src/match/pressure.ts`
- Modifica: `packages/engine/src/match/match.ts` (`simulateBlock` → `simulateMinute`; `run` avanza di un minuto per volta; `beginMatch` inizializza i campi v2)
- Test: `packages/engine/test/pressure.test.ts`, `packages/engine/test/match.test.ts`

**Interfacce prodotte:**
- `stepPressure(p: number, push: number, impulse: number, rng: Rng, cfg: MatchConfig['pressure']): number`: `clamp(p·decay + push + impulse + noise·(rng.next()·2−1), −1, 1)`.
- `pushFor(ratings: Record<Side, number>, side: Side, neutral: boolean, cfg): number`: spinta da differenza di rating e campo di casa.
- `goalChancePerMinute(xg: number, p: number, cfg): number`: `xg/90 · exp(goalBoost·p) / norm`, con `norm` = media di `exp(goalBoost·p)` stimata come `exp(goalBoost²·σ²/2)` e σ preso dalla config (aggiungi `pressure.sigma`, iniziale 0,35). Serve a non spostare la media dei gol.
- In `MatchState` il punteggio cresce in ordine cronologico; `describeMoment` usa `m.score` (via il filtro "gol già avvenuti").
- In questo task i momenti si piazzano ancora con `planMomentMinutes`, chiamata una volta a `beginMatch`; l'elenco sta in `director.plannedMinutes`, così la ripresa a metà partita resta esatta. Il regista arriva in A5 e toglie il campo.

- [ ] **Passo 1: test.** `stepPressure stays in [-1,1]`, `stronger side has positive mean pressure over 10k minutes`, `same seed same trace`, `average goals per match within ±5% of baseline over 2000 simulated matches` (valore atteso dalla baseline A0), `score is chronological: no event after minute m when paused at m`, `resume after pause equals continuous play (plannedMinutes)`.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementa; `trace` aggiunge un valore per minuto; la pressione alta del lato avversario aumenta i suoi gol con la stessa funzione.
- [ ] **Passo 4:** `pnpm test` → PASS; `pnpm sim --careers 1000 --strategy cautious --seed 42` dentro i guardrail.
- [ ] **Passo 5:** commit `feat(engine): partita al minuto con barra della pressione`.

### Task A4: posta in gioco (stakes), avversario chiave e osservatore

**File:**
- Crea: `packages/engine/src/match/stakes.ts`
- Modifica: `packages/engine/src/types.ts` (`Fixture.scout?: boolean`), `packages/engine/src/season/week.ts` (estrazione dell'osservatore per la partita della settimana successiva, con `stakes.scoutChance`)
- Test: `packages/engine/test/stakes.test.ts`

**Interfacce prodotte:**
- `type StakeSignal = 'cup' | 'derby' | 'top' | 'debut' | 'contractExpiring' | 'lowTrust' | 'scout' | 'keyOpponent'`. Il nome `rival` resta riservato al rivale di carriera (spec del 17/11 §9.2, non ancora implementato): quando esisterà, sarà un segnale a parte con la precedenza su `keyOpponent`.
- `matchSignals(state: GameState, fixture: Fixture, ctx): StakeSignal[]`: `cup`/`derby`/`top` da `bigMatchKind` (`media.ts:398`); `debut` = nessuna presenza nel livello del club attuale; `contractExpiring` = `contract.untilSeason === state.season`; `lowTrust` = relazione col mister `< stakes.lowTrustBelow`; `scout` = `fixture.scout`; `keyOpponent` = l'avversario ha in rosa un giocatore dello stesso ruolo con rating `≥ OVR del giocatore − keyOpponentGap`.
- `matchStakes(signals: StakeSignal[], cfg): number`: il massimo dei pesi, in [0,1].
- `keyOpponentOf(state, fixture, ctx): RosterPlayer | null` (nome per la cronaca e il segnaposto `{opponent}`).

- [ ] **Passo 1: test.** Uno per segnale, `stakes is max not sum`, `no signals → 0`, `scout drawn deterministically from seed`, `scout only on player's next fixture`.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementa e salva `stakes` in `MatchState` a `beginMatch`. **Passo 4:** PASS.
- [ ] **Passo 5:** commit `feat(engine): posta in gioco della partita, avversario chiave e osservatore`.

### Task A5: regista della partita

**File:**
- Crea: `packages/engine/src/match/director.ts`
- Modifica: `packages/engine/src/match/match.ts` (`run` chiede al regista a ogni minuto; via `planMomentMinutes` da `moments.ts` e `director.plannedMinutes`)
- Modifica: `packages/content/data/` (righe di preavviso `match.buildup.<phase>.<n>`, almeno 4 per fase), `packages/content/scripts/check.ts`
- Test: `packages/engine/test/director.test.ts`

**Interfacce prodotte:**
- `tension(m: MatchState, cfg: MatchConfig['director']): number`, con d = gol del giocatore − gol avversari (limitato a ±3) e t = `m.minute`:
  `wGame·close[d]·(timeBase + (1−timeBase)·(t/90)^timeExp) + wStakes·m.stakes + wPress·max(0, |pressure| − pressure.dangerAt)`.
- `initialDirector(mode: MatchMode, minutesOnPitch: number, rng: Rng, cfg): DirectorState`: budget = `rng.int(...modes[mode])` scalato sui minuti in campo (arrotondato, minimo 1 se `minutesOnPitch ≥ minMinutesForMoment`, altrimenti 0).
- `shouldIntervene(m: MatchState, rng: Rng, cfg): boolean`: falso se il giocatore non è in campo, se c'è già un `armed` o un `pending`, se `budgetLeft = 0`, se `minute < relaxUntil`, o se sono passati meno di `minGap` minuti (`hotGap` nel finale caldo) da `lastAt`. Poi vero se `T ≥ threshold` e `rng.chance(min(pMax, (T − threshold)·hazard))`.
- **Riserva del finale (in passi):** prima di `hotFrom` una radice si apre solo se `budgetLeft − chainDepth(tipo) ≥ min(hotSlots, budgetStart − 1)`. Al primo minuto `≥ hotFrom`: se |d| ≤ 1, `hotLeft = min(hotSlots, budgetLeft)` e vale `hotGap`; `hotLeft` scende a ogni passo aperto dopo `hotFrom` (anche dentro una catena) e il finale caldo finisce a `hotLeft = 0`. Se non c'è bilico la riserva si libera e valgono le regole normali.
- **Minimo garantito:** se al minuto `minuteOut − armLead` non c'è stato nessun intervento, `budgetLeft > 0` e il giocatore è in campo da almeno `minMinutesForMoment`, il regista arma comunque una radice (ignora soglia e respiro). L'apertura avviene a `minuteOut`.
- La fase del momento segue il segno della pressione: `pickMomentType(role, phase, m: MatchState, rng, ctx)` filtra per `phase` (fallback all'altra fase se non ci sono tipi). L'ultimo tipo proposto è escluso se esiste un'alternativa. Peso di ogni altro tipo: peso di ruolo × `repeatPenalty` se il tipo è negli ultimi 3 di `director.lastTypes`, × `(1 + dynAffinity)` se il tipo dichiara in config uno stato `dyn` affine (`affinity?: DynKey`, es. passaggio con `marking` alto) e quello stato è ≥ 1.
- **Preavviso (solo radici):** quando `shouldIntervene` è vero al minuto m, il regista sceglie il tipo e mette `armed = { at: m + armLead, momentId }`; al minuto m la cronaca aggiunge un evento `buildup` (riga per fase, variante da `Rng`); a `armed.at` si apre il `pending` e scende il budget. Si arma solo se `m + armLead ≤ min(90, minuteOut)`; un `armed` esistente non si sovrascrive mai. I passi successivi di una catena non hanno preavviso (stanno nel minuto della radice).
- **Ordine dentro un minuto:** 1) pressione e gol del minuto; 2) se c'è un gol: `armed` annullato senza consumare budget, `relaxUntil` aggiornato; 3) se il giocatore esce in questo minuto: `armed` annullato; 4) se `armed.at = minuto`: si apre il `pending`; 5) altrimenti, se non c'è `armed`, si valuta `shouldIntervene` (o il minimo garantito).
- **Respiro:** dopo un gol o la fine di una catena `relaxUntil = minuto + relaxMinutes`, oppure `minuto + hotGap` nel finale caldo. Il minimo garantito ignora il respiro.
- **Passo decisivo:** a ogni passo aperto, se la tensione corrente supera `peak.tension`, `peak` si aggiorna; l'esito lo completa `decideMoment`.

- [ ] **Passo 1: test.** `0-0 at 10' with stakes 0 does not intervene (10k seeds < 5%)`, `1-1 at 88' intervenes above threshold`, `respects minGap`, `hot finale lowers gap and reserves slots`, `never intervenes off pitch`, `bench player: 0 interventions, no crash`, `at least 1 intervention if on pitch ≥ minMinutesForMoment`, `mean interventions in full mode with player on pitch 90' ≥ 3 over 2000 matches` (i 5–7 passi totali si raggiungono con le catene: test in A7), `same seed same intervention minutes`, `resume after pause equals continuous play` (serializza a ogni momento e a ogni `armed`, deserializza, confronta il report), `buildup event precedes every root moment by armLead`, `armed is never overwritten`, `substitution before armed.at cancels it`, `guaranteed minimum armed at minuteOut − armLead`, `hot reserve: before hotFrom a root opens only if the reserve still fits`, `hotLeft decreases with every step after hotFrom`, `goal before armed.at cancels it and keeps budget`, `no intervention during relax (relaxMinutes, hotGap in hot finale)`, `same type never proposed twice in a row when alternatives exist`, `high marking raises share of affine types`, `peak is the step with highest tension`, `content:check finds buildup keys`.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementa. **Passo 4:** `pnpm test` PASS e simulatore nei guardrail.
- [ ] **Passo 5:** commit `feat(engine): regista della partita guidato dalla tensione`.

### Task A6: conseguenze nella partita (dyn)

**File:**
- Modifica: `packages/engine/src/match/moments.ts` (`optionChance` riceve `dyn`), `packages/engine/src/match/match.ts` (`decideMoment` applica `outcome.effects`)
- Test: `packages/engine/test/match.test.ts`

**Interfacce:**
- `optionChance(player, option, opponentRating, ctx, difficultyBonus = 0, quality = 0.5, dyn: MatchDyn = ZERO_DYN): number`: aggiunge `Σ dyn.chanceWeight[k]·m.dyn[k]` ai modificatori.
- `applyEffects(m: MatchState, effects, cfg): MatchState`: somma ai `dyn` (limitati fra `dyn.min` e `dyn.max`) e alla pressione (limitata a ±1).
- `KeyMoment` aggiunge `dyn: MatchDyn` e `pressure: number` (per la cronaca e la strategia contestuale).

- [ ] **Passo 1: test.** `successful dribble raises marking and lowers next dribble chance`, `fatigue lowers chance`, `effects clamp to dyn.min/max`, `dyn resets each match`, `default dyn keeps old chances identical`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS.
- [ ] **Passo 5:** commit `feat(engine): conseguenze degli esiti nel resto della partita`.

### Task A7: catene e contropiede

**File:**
- Modifica: `packages/config/data/moments.json` (catene), `packages/engine/src/match/match.ts` (`decideMoment` segue `next`)
- Modifica: `packages/content/data/` (chiavi `match.moments.<id>.*` dei nuovi tipi), `packages/content/scripts/check.ts` (chiavi dei tipi di `moments.json`)
- Test: `packages/engine/test/chains.test.ts`

**Delega:** i contenuti delle catene (tipi `chainOnly`, opzioni e testi) li scrive `ai-codex standard --scrivi` in background su `moments.json` e sui testi, seguendo `docs/content-style-guide.md`; il codice di `decideMoment` lo scrive chi esegue. Poi verifica `content:check` e la rilettura dei testi.

**Comportamento:**
- `chainDepth(typeId, ctx): number` (profondità massima del percorso, calcolata dalla config): il regista apre un tipo solo se `chainDepth ≤ budgetLeft`; altrimenti estrae fra i tipi della fase che ci stanno (nessuna catena troncata per budget, spec §8.1).
- Se l'esito ha `next` e `rng.chance(next.chance ?? 1)`, il prossimo `pending` è `next.momentId` **allo stesso minuto** della radice, con `chain = { rootId, step: step + 1 }`; il motore non avanza i minuti dentro una catena, quindi non può uscire dal campo né oltre il 90'. `goalFor`/`goalAgainst` dell'esito non si applicano. L'intervallo minimo non vale dentro una catena.
- Se l'estrazione di `next.chance` fallisce, si applicano `goalFor`/`goalAgainst` dell'esito come oggi.
- Contenuti minimi: per ogni ruolo almeno una catena di 2 passi in attacco e una in difesa; `counter_recovery` (`chainOnly`, `phase: defense`) come `failure.next` dei passaggi e dribbling persi, `chance` 0,6.
- **Insisti o chiudi:** ogni tipo `chainOnly` (dal secondo passo in poi) ha esattamente un'opzione `closes: true`, `risk: safe`, senza `next`, con un guadagno piccolo (pressione o +voto ridotto, niente gol). Un'opzione `closes` non estrae: esito `success` sempre, senza consumare `Rng` (il gesto non conta). Regole verificate dal validatore della config: nessun `next`, nessun gol nell'esito.
- **Telegrafare:** `describeMoment` espone per ogni opzione `onFail: 'counter' | 'lost' | 'none'` (da `failure.next` e `failure.goalAgainst`) e `chanceBand: 'low' | 'mid' | 'high'` dalla probabilità vera con le soglie `chanceBands`.

- [ ] **Passo 1: test.** `pass success leads to cross then header`, `failure with next does not apply goalAgainst`, `chain is never opened when chainDepth > budgetLeft`, `failed next.chance applies outcome goals`, `chain steps share the root minute`, `full mode: 5–7 steps in ≥ 80% of matches with player on pitch 90'`, `chain depth never exceeds chainMaxSteps`, `resume mid-chain equals continuous`, `content:check finds all moment text keys`, `every chainOnly type has exactly one closes option`, `closes option ends the chain without goals`, `closes option always succeeds without consuming rng`, `chanceBand matches real chance`, `onFail is counter when failure.next is counter_recovery`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS; `pnpm content:check` PASS.
- [ ] **Passo 5:** commit `feat(engine): azioni a catena e contropiede` e `content: catene dei momenti chiave`.

### Task A7b: momenti da leggenda

**File:**
- Modifica: `packages/config/data/moments.json` (opzioni `legend`), `packages/engine/src/match/match.ts` (`describeMoment` filtra le opzioni `legend`; `decideMoment` applica il premio)
- Modifica: `packages/content/data/` (chiavi `match.legends.<id>.*`: testo dell'opzione, esito riuscito, esito fallito, titolo per la prima pagina)
- Test: `packages/engine/test/legends.test.ts`

**Delega:** catalogo e testi li scrive `ai-codex standard --scrivi` in background (file di contenuto separati), con la regola: solo archetipi, nessun nome, data o partita reale riconoscibile per citazione; tono della guida di stile. Chi esegue scrive il codice e rilegge i testi.

**Comportamento:**
- Disponibilità fissata all'apertura del passo: `availableOptions(m, typeId, ctx): number[]` calcola gli indici delle opzioni della config e li salva in `pending.options`; `describeMoment` li mostra in quell'ordine e `decideMoment` interpreta `optionIndex` come posizione in `pending.options` (fuori range → errore). Così ripresa e indici restano coerenti. Per i tipi senza leggende `pending.options` è `[0..n−1]` e il comportamento di oggi non cambia (la migrazione v1 lo riempie così).
- Un'opzione con `legend` compare solo se: il passo è dentro una catena (`pending.chain` presente, step ≥ 2), è l'ultimo passo possibile (nessun `next` nelle uscite dell'opzione), la tensione corrente ≥ `legend.minTension`, ogni abilità in `legend.skills` è raggiunta, e `director.legendsUsed < legends.perMatch`. Altrimenti non c'è (nessuna opzione "bloccata" a schermo). `legendsUsed` sale quando l'opzione viene **offerta**, anche se il giocatore ne sceglie un'altra.
- È sempre `risk: risky`; la probabilità segue `optionChance` come le altre, senza bonus nascosti.
- Riuscita: esito normale + `legends.ratingBonus` al voto e `legends.popularity` a `image.popularity`; `MatchState.legend = { id, success: true }`, copiato in `matchReport.legend` (per prima pagina e, in futuro, album del 17/11 §9). Fallimento: esito normale dell'opzione e `legend = { id, success: false }`.
- Catalogo minimo: 3 per ruolo. ATT: rovesciata, cucchiaio sul rigore, tiro al volo da fuori. MID: lancio di cinquanta metri, gol da centrocampo, tacco smarcante. DEF: scivolata pulita sull'ultimo uomo, salvataggio sulla linea, anticipo in tuffo di testa. GK: doppia parata, colpo di reni sotto l'incrocio, rigore parato nel finale.

- [ ] **Passo 1: test.** `legend option hidden below minTension`, `legend option hidden when skills too low`, `at most legends.perMatch per match`, `legend only on last chain step, never on a root`, `offering a legend consumes legendsUsed even if not chosen`, `optionIndex maps through pending.options`, `resume keeps the same available options and legend result`, `legend chance equals optionChance (no hidden bonus)`, `success adds rating and popularity`, `matchReport.legend set on success and failure`, `legends appear in < 10% of full matches with player on pitch 90'` (rarità, misurata su 2000 partite), `content:check finds legend keys`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS; `pnpm content:check` PASS; simulatore nei guardrail.
- [ ] **Passo 5:** commit `feat(engine): momenti da leggenda` e `content: catalogo dei momenti da leggenda`.

### Task A8: rischio contestuale e strategia "contestuale"

**File:**
- Modifica: `packages/engine/src/match/moments.ts` (bonus di rischio), `packages/engine/src/match/match.ts` (`describeMoment` espone il valore)
- Modifica: `packages/simulator/src/strategies.ts` (`contextual`, profili di qualità), `packages/simulator/src/cli.ts`
- Test: `packages/engine/test/risk.test.ts`, `packages/simulator/test/simulator.test.ts`

**Delega:** la strategia `contextual` e i profili di qualità li scrive `ai-codex standard --scrivi` in background su `packages/simulator/` (file separati dal motore); chi esegue la verifica e la integra.

**Interfacce:**
- `riskBonus(risk, d, minute, cfg): number`: dopo `risk.lateFrom`, `risky` prende `+behindBonus` se d < 0 e `safe` prende `+aheadSafeBonus` se d > 0; altrimenti 0. Entra in `optionChance` come addendo dei modificatori (nuovo parametro `riskBonus = 0`).
- `KeyMomentOption` aggiunge `risk` e `value: number`: valore atteso del voto e dei gol, con il gol pesato da `close[d]` (un gol vale di più nel bilico).
- `Strategy.decideMoment(moment, rng): number | MatchDecision`; `contextual` sceglie l'opzione con `value` massimo; `cautious` resta la probabilità massima; `aggressive` sceglie la più rischiosa.
- Profili di qualità per strategia: `cautious` e `aggressive` 0,5; `contextual` 0,5; nuova opzione CLI `--quality <0..1>` per misurare chi fa bene il gesto.
- `STRATEGIES` aggiunge `'contextual'`. Nuova opzione CLI `--isolate`: tutte le strategie usano `planWeek`, `playsManually`, `chooseEvent` e `pickOffer` di `cautious` e cambiano solo `decideMoment`. Il criterio §8.3 si misura sempre con `--isolate`.

- [ ] **Passo 1: test.** `riskBonus only late and by score`, `option value prefers risky when behind late`, `with isolate, strategies differ only in match decisions` (stessi piani a parità di seme), test del criterio con 2000 carriere a seme fisso e `isolate`: `voto(contextual) > voto(cautious)`, `voto(contextual) > voto(aggressive)`, `|voto(cautious) − voto(aggressive)| ≤ 0.2`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS (se il criterio non regge, si tara in A10, non si cambia il test).
- [ ] **Passo 5:** commit `feat(engine): rischio contestuale` e `feat(simulator): strategia contestuale`.

### Task A9: modalità completa, rapida, simula e stima del tempo

**File:**
- Modifica: `packages/engine/src/match/match.ts` (`beginMatch(state, ctx, opts?: { mode?: MatchMode })`, default `'full'`; `simulateMatch` usa `'sim'`; `playMatch(state, decide, ctx, opts?)`)
- Modifica: `packages/simulator/src/run.ts:39` (`SECONDS_PER` esce dal codice e va in `packages/config/data/simulator.json > secondsPer`, con schema Zod)
- Test: `packages/engine/test/match.test.ts`, `packages/simulator/test/simulator.test.ts`

**Valori (in `simulator.json > secondsPer`):** `{ week: 4, event: 15, momentStep: 8, chainStep: 5, fullMatch: 150, quickMatch: 25, simulatedMatch: 3, offer: 10 }` (la partita completa vale 2,5 minuti di cronaca più i passi). Il commento dice che sono stime, da confrontare con 20–30 minuti a stagione e 6–8 ore a carriera.

**Passo decisivo:** `MatchReport` aggiunge `peak: { minute; momentId; success; closingKey } | null` da `director.peak`; `closingKey` = `match.peak.<success|failure>.<n>` (variante da `Rng`), la riga di chiusura della pagella. Partita senza passi: `peak = null`.

- [ ] **Passo 1: test.** `quick mode has 1–2 steps`, `sim mode decides with autoDecider and never pauses`, `default mode is full`, `time estimate counts chain steps separately`, `report.peak is the highest-tension step with its outcome`, `no steps → peak null`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS.
- [ ] **Passo 5:** commit `feat(engine): modalità della partita e stima del tempo`.

### Task A10: taratura graduale

- [ ] **Passo 1:** simulatore con 5000 carriere per `cautious`, `aggressive`, `random`, `contextual`, seme 42; confronto con la baseline in `reports/regista/confronto-A10.md`.
- [ ] **Passo 2:** alza i pesi (`dyn.chanceWeight`, `risk.*`, `pressure.goalBoost`, `qualityMaxBonus`) un parametro alla volta; dopo ogni modifica riesegui 1000 carriere e tieni la modifica solo se i guardrail reggono. Annota ogni giro nel report.
- [ ] **Passo 3:** criterio §8.3 verificato a 5000 carriere; `qualityMaxBonus` finale e motivo nel report.
- [ ] **Passo 4:** `CHANGELOG.md`, `.claude/memory/` (nuovo file `regista-partita.md` + indice), commit `chore(config): taratura del regista della partita`.

---

# Parte B: stagione a capitoli

### Task B1: capitoli e regista della stagione

**File:**
- Modifica: `packages/config/data/calendar.json` (`chapters`), `packages/config/src/schemas.ts`, `packages/engine/src/types.ts`, `packages/engine/src/save/serialize.ts`
- Crea: `packages/engine/src/season/director.ts`
- Test: `packages/engine/test/seasonDirector.test.ts`

**Config:**

```json
"chapters": [
  { "id": "preseason", "fromWeek": 0 }, { "id": "autumn", "fromWeek": 6 },
  { "id": "winter", "fromWeek": 20 }, { "id": "spring", "fromWeek": 32 }, { "id": "finale", "fromWeek": 44 }
],
"chapterMatches": { "min": 2, "max": 3 }
```
(settimane da 0 come `calendar.json`: `firstMatchWeek` 6, sosta 25–26 e mercato invernale 25–28 dentro `winter`; validazione: crescenti, prima = 0, dentro `weeksPerSeason`). Se un capitolo non ha partite del giocatore (preparazione senza amichevoli), sceglie 0 partite.

**Interfacce:**
- `chapterOf(week: number, cfg): ChapterId`.
- `scoreFixture(state, fixture, ctx): number`: `matchStakes(matchSignals(...))` più un peso per la classifica (posizione vicina alla zona promozione o retrocessione, pesi in config `chapterWeights`).
- `pickChapterMatches(state, chapter, ctx): { fixtureId: string; mode: 'full' | 'quick' }[]`: le 2–3 partite con punteggio più alto fra quelle future del capitolo, la prima in `full`, le altre in `quick`; spareggi decisi da `Rng`. Le partite di coppa a eliminazione nate durante il capitolo vengono rivalutate a ogni stop.
- `GameState` aggiunge `chapter: { id: ChapterId; picks: { fixtureId: string; mode: 'full' | 'quick' }[] }` e `chapterPlan: WeekChoice[]` (`season` resta il numero della stagione). Migrazione in questo task: `CURRENT_SAVE_VERSION = 3`, `migrations[2]`: `chapter` calcolato dalla settimana con `picks` da `pickChapterMatches`, `chapterPlan = lastPlan ?? []`.

- [ ] **Passo 1: test.** `chapters cover 52 weeks`, `picks are future fixtures of the chapter`, `derby and decisive matches are preferred`, `first pick full, others quick`, `deterministic from seed`, `cup match drawn mid-chapter can replace a pick`, `migrates v2 save to v3 with chapter and chapterPlan`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS.
- [ ] **Passo 5:** commit `feat(engine): stagione a capitoli e regista della stagione`.

### Task B2: piano per capitolo e "vai al prossimo stop"

**File:**
- Modifica: `packages/engine/src/season/plan.ts:182` (`chapterPlan` sostituisce `lastPlan` come piano ricordato), `packages/engine/src/season/fastForward.ts`
- Modifica: `packages/engine/src/index.ts`, `packages/config/data/calendar.json` + `packages/config/src/schemas.ts` (`headlines: { max: 3, ratingFrom: 7.5, priority: [...] }`), `packages/content/data/` (chiavi `headlines.<kind>.<n>`, almeno 2 varianti per tipo), `packages/content/scripts/check.ts`
- Test: `packages/engine/test/fastForward.test.ts`, `packages/engine/test/save.test.ts`

**Interfacce:**
- `setChapterPlan(state, choices: WeekChoice[], ctx): GameState`.
- `advanceToStop(state, ctx): { state; report: FastForwardReport }`: ripete `chapterPlan` (regole di `repeatPlan`) e simula le settimane fino alla prossima partita scelta, a un evento da risolvere di persona, a un'offerta (`worthStopping`), a fine capitolo (stop per il nuovo piano), a fine stagione o al ritiro. `FastForwardStop` aggiunge `'pick' | 'chapterEnd'`. `fastForward(state, target)` resta per il simulatore e diventa un wrapper.
- `FastForwardReport` aggiunge `summary: { fixtureId: string; result: 'win' | 'draw' | 'loss'; rating: number | null }[]` per il riepilogo.
- **Prima pagina:** `FastForwardReport` aggiunge `headlines: Headline[]`, con `Headline = { kind: HeadlineKind; textKey: string; params: Record<string, string | number> }` (0–3; zero solo se il tratto non ha candidati, es. stop immediato) e `HeadlineKind = 'legend' | 'peak' | 'rating' | 'table' | 'event' | 'result'`. Candidati dalle settimane del tratto: momenti da leggenda, passo decisivo delle partite giocate, voto ≥ `headlines.ratingFrom`, cambio di zona in classifica (promozione, playoff, retrocessione), eventi risolti, risultato del club. Priorità in `calendar.json > headlines.priority` (nell'ordine sopra), al massimo `headlines.max` (3), mai due dello stesso `kind`; si sceglie per priorità e poi per settimana più recente, senza `Rng`.
- Le partite non scelte si simulano con `simulateMatch` (modalità `sim`), così i voti restano confrontabili.
- Non esiste un'API per giocare una partita non scelta (decisione dell'utente).

- [ ] **Passo 1: test.** `stops before each pick`, `stops at chapter end`, `stops for events and offers as today`, `summary lists skipped matches with rating`, `headlines: at most 3, no duplicate kind, legend first when present`, `zero headlines only when there are no candidates`, `content:check finds headline keys`, `headlines deterministic without rng`, `every week still runs advanceWeek` (finanze e recupero invariati rispetto alla settimana manuale a parità di seme).
- [ ] **Passi 2–4:** FAIL → implementa → PASS.
- [ ] **Passo 5:** commit `feat(engine): piano per capitolo e avanti fino al prossimo stop`.

### Task B3: simulatore a capitoli e misura del tempo

**File:**
- Modifica: `packages/simulator/src/run.ts` (ciclo di carriera con `advanceToStop`, partite scelte in `full`/`quick`, piano per capitolo), `packages/simulator/src/metrics.ts` (minuti per stagione, ore per carriera)
- Test: `packages/simulator/test/simulator.test.ts`

- [ ] **Passo 1: test.** `career loop plays only picked matches manually`, `reports minutes per season and hours per career`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS.
- [ ] **Passo 5:** 5000 carriere per strategia; obiettivo: mediana 20–30 minuti a stagione e 6–8 ore a carriera, guardrail dentro la tolleranza. Se fuori, taratura di `chapterMatches`, `modes` e `SECONDS_PER` (le ultime con motivo nel report). Report in `reports/regista/stagione-B3.md`.
- [ ] **Passo 6:** `CHANGELOG.md`, memoria (`regista-stagione.md`), commit `feat(simulator): carriera a capitoli e misura del tempo`.

### Task B4: obiettivo del capitolo

**File:**
- Crea: `packages/content/data/chapter-goals.json` (+ schema Zod nel validatore dei contenuti), `packages/engine/src/season/goals.ts`
- Modifica: `packages/engine/src/types.ts` (`chapter.goal`), `packages/engine/src/season/fastForward.ts` (verifica a fine capitolo), `packages/config/data/calendar.json` (`chapterGoals`)
- Test: `packages/engine/test/chapterGoals.test.ts`

**Delega:** gli obiettivi e i testi li scrive `ai-codex standard --scrivi` in background su `chapter-goals.json` e sui testi; chi esegue scrive `goals.ts`.

**Formato di un obiettivo:** `{ id, weight, conditions (stesso formato delle condizioni degli eventi: ruolo, età, livello, stats), metric: 'starts' | 'goals' | 'assists' | 'avgRating' | 'cleanSheets' | 'pickGoal' | 'tablePosition', target: number, textKey }`. `pickGoal` = segnare in una delle partite scelte dal regista; `tablePosition` = posizione del club ≤ target a fine capitolo.

**Interfacce:**
- `pickChapterGoal(state, chapter, rng, ctx): ChapterGoal | null`: filtra per condizioni, esclude l'obiettivo del capitolo precedente, estrae pesato con `Rng`. `preseason` → `null`.
- `evaluateChapterGoal(state, goal, ctx): { met: boolean; progress: number }`: dai dati delle settimane del capitolo.
- A fine capitolo (stop `chapterEnd`): se raggiunto, `chapterGoals.rewardTrust` sulla relazione col mister e `chapterGoals.rewardMorale`; se mancato, solo `chapterGoals.missMorale` (piccolo, valori in config). L'esito diventa un `Headline` di tipo `event`.
- `GameState.chapter` aggiunge `goal: { id: string; target: number; baseline: number; progress: number; settled: boolean } | null` e `lastGoalId: string | null`. `baseline` è il valore della metrica a inizio capitolo (le statistiche del giocatore sono stagionali); `progress` si aggiorna a fine di ogni settimana (per `pickGoal`, dopo ogni partita scelta); `settled` impedisce di liquidare due volte. Si liquida allo stop `chapterEnd` o a fine stagione, quello che viene prima. Stesso formato v3 di B1 (regola dei vincoli globali): la migrazione v2→v3 mette `goal: null`, `lastGoalId: null`.

- [ ] **Passo 1: test.** `goal picked at chapter start and not repeated`, `preseason has no goal`, `conditions filter by role` (GK non riceve `goals`), `met goal applies rewards`, `missed goal applies only missMorale`, `goal result appears in headlines`, `deterministic from seed`, `migration adds goal null`, `resume mid-chapter keeps progress`, `goal settled once even if season ends in the same week`.
- [ ] **Passi 2–4:** FAIL → implementa → PASS; `pnpm content:check` PASS.
- [ ] **Passo 5:** simulatore con 1000 carriere: guardrail dentro la tolleranza (le ricompense sono piccole di proposito).
- [ ] **Passo 6:** commit `feat(engine): obiettivo del capitolo` e `content: obiettivi dei capitoli`.

---

## Esecuzione e deleghe

- Review prima del "fatto" di ogni parte: `git diff` del blocco più i file nuovi a `ai-codex standard` via stdin.
- Task A7, A7b e B4 (contenuti) e A8 (strategia del simulatore): `ai-codex --scrivi` in background su file separati.
- Fonti e motivazioni delle meccaniche aggiunte: `reports/Meccaniche regista partita e stagione.md`; decisioni in spec §8.4.
- L'app oggi legge `currentMatch.events` e `side` (`match.page.ts:1019`, `proof.page.ts:312`): restano compatibili; `blocksDone` e `momentMinutes` non sono letti fuori da `match.ts`/`moments.ts`/`types.ts` (verificato).
