# Settimana leggibile — piano di implementazione

> **Per chi esegue:** sub-skill obbligatoria `superpowers:subagent-driven-development` (consigliata) o
> `superpowers:executing-plans`, un task alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** sostituire il piano a 2 azioni su 9 con due binari (carico in campo + un'azione fuori dal
campo), una sola freschezza al posto di energia e rischio, anteprima esatta prima e registro dopo.

**Architettura:** prima si scrive la logica nuova come funzioni pure isolate (freschezza, carico, vita),
poi un solo task cambia l'API (`WeekPlan`, salvataggio v4) in motore, simulatore e app insieme, così
ogni commit compila. Anteprima, registro, simulatore, taratura e UI vengono dopo, sulla nuova API.

**Tecnologie:** TypeScript strict, Zod (`packages/config/src/schemas.ts`), Vitest, Angular/Ionic, zzfx.

**Spec:** `docs/superpowers/specs/2026-11-20-settimana-leggibile-design.md` (va letta insieme a questo piano;
i numeri di config vengono da lì, §5.8, e sono ipotesi da tarare nel Task 12).

## Vincoli globali

- Motore puro: niente `Math.random()`, `Date.now()`, API del browser; ogni casualità da `Rng` nello stato.
- Nessun numero di bilanciamento nel codice: tutto in `packages/config/data/*.json`, validato con Zod.
- Nomi in inglese, commenti in italiano, testi al giocatore in `packages/content/data/i18n/it.ui.json` / `it.json`.
- Commit in italiano, Conventional Commits, branch `ciro-dev`, nessun riferimento ad AI; niente commit che non compila o con test rossi.
- Ogni modifica a `config/` va accompagnata da un'esecuzione del simulatore e dal confronto con la baseline (Task 0).
- Ogni schermata o componente UI: skill `frontend-design` (e `game-ui-ux`, `game-feel`) e token di `docs/design-system.md`.
- Animazioni 150–250 ms, tolte con `prefers-reduced-motion`; bersagli al tocco ≥ 44 px; contrasto AA.
- Non committare: modifiche iOS, `packages/app/ios/`, `reports/` di ricerca esistenti, `research_notes/`, `.DS_Store`, `founder-*`.
- Prima di dire "fatto" su un blocco: `~/.ai/shell/ai-codex standard` sul diff del blocco.

## Focus di revisione

1. **Salvataggio v3 a metà capitolo, giocatore infortunato, piano con serata:** deve caricarsi, il piano migrato ha `load: 'balanced'`, `life: 'party'`, e la settimana non si ripianifica né riapplica effetti. Test nel Task 7.
2. **Sponsor scelto, poi lo sponsor scade a metà capitolo:** il piano ripetuto non deve scartare in silenzio né lanciare; il capitolo continua con `life` ignorata quella settimana e lo stop successivo lo segnala (`planIssues`). Test nel Task 7.
3. **Freschezza sopra il tetto quando si passa a Spinta** (es. 95 → tetto 70): il clamp di fine settimana porta a 70, l'anteprima lo mostra come calo dichiarato, non come costo nascosto. Test nei Task 4 e 9.
4. **Abilità con decimali nell'editor, nei salvataggi vecchi e nell'OVR:** OVR e UI usano `floor`, i confronti di soglia (eventi, offerte) leggono il valore pieno, nessun "62" mostrato con 61,99. Test nel Task 3.
5. **Giocatore senza partner con Famiglia:** il morale protetto vale comunque, nessun errore su `relationships` vuote; il testo non parla di partner. Test nel Task 5.

---

### Task 0: Baseline del simulatore

**File:**
- Create: `reports/settimana-leggibile/baseline.md` (+ JSON grezzi accanto)

- [ ] **Passo 1:** sul codice di oggi (`d8a5067` o successivo senza modifiche al motore) esegui
  `pnpm sim --careers 5000 --strategy cautious --seed 42` e lo stesso con `contextual`; salva JSON e tabella.
- [ ] **Passo 2:** scrivi nel report: % massima serie, OVR massimo medio, presenze, gol, % leggenda,
  `score.total` medio, minuti per stagione e ore per carriera, per le due strategie. Sono i riferimenti
  del criterio 5 (±10%, leggende 1–5%).
- [ ] **Passo 3:** commit `docs(sim): baseline prima della settimana leggibile`.

### Task 1: Schema e parametri nuovi in config (accanto ai vecchi)

**File:**
- Modify: `packages/config/src/schemas.ts` (`progressionSchema` ~riga 811, schema di `match`)
- Modify: `packages/config/data/progression.json`, `packages/config/data/match.json`
- Test: `packages/config/test/` (file schema esistente, o nuovo `weekPlan.test.ts`)

**Interfacce:**
- Produce: `ProgressionConfig['loads']: Record<'rest'|'balanced'|'push'|'recovery', LoadConfig>` con
  `LoadConfig = { freshnessCap; freshness; sessions; sessionInjury; formNotPlaying; decline; healChance? }`;
  `ProgressionConfig['life']: { family: { moraleLossFactor; affinityDriftFactor }, leisure: { moraleRecoveryFactor },
  sponsor: { sponsorWeeksPerWeek; freshness }, party: { popularity; discipline; partnerAffinity; gossipChance; fineChance } }`;
  `growth.focusShare`, `growth.focusLoss`, `growth.freshnessFactor.atZero`, `discipline.driftPerWeek`,
  `condition.freshnessPer90`, `events.riskToFreshness`, `injuries.freshnessCurve.{at100,at0}`,
  `preview.riskBands.{medium,high}`; in match: `moments.freshnessWeight`, `selection.freshnessFrom`, `selection.freshnessWeight`.
  I valori sono quelli della spec §5.8 e §5.2. `skipWeekPlan` nuovo nome `skipWeekPlanV4 = { load: 'balanced' }` finché il Task 7 non toglie il vecchio.

- [ ] **Passo 1:** test che `progressionSchema.parse` del JSON reale contenga `loads.push.freshnessCap === 70`, `loads.balanced.sessions === 1`, `life.leisure.moraleRecoveryFactor === 2`; e che `freshnessCap > 100` o `sessions < 0` siano rifiutati.
- [ ] **Passo 2:** eseguilo, deve fallire.
- [ ] **Passo 3:** aggiungi schema e valori; i campi vecchi (`actions`, `actionsPerWeek`, `skipWeekPlan`, `energyWeight`) restano.
- [ ] **Passo 4:** `pnpm test` verde.
- [ ] **Passo 5:** commit `feat(config): parametri della settimana a due binari`.

### Task 2: Funzioni della freschezza

**File:**
- Create: `packages/engine/src/player/freshness.ts`
- Test: `packages/engine/test/freshness.test.ts`

**Interfacce:**
- Produce:
  - `growthFreshnessFactor(freshness: number, ctx): number` — lineare da `atZero` (0) a 1 (100).
  - `injuryFreshnessFactor(freshness: number, ctx): number` — lineare da `at0` (0) a `at100` (100).
  - `selectionFreshnessPenalty(freshness: number, ctx): number` — `max(0, freshnessFrom − f) × freshnessWeight`.
  - `momentFreshnessModifier(freshness: number, ctx): number` — `freshnessWeight × (f − 50) / 50`.
  - `endOfWeekFreshness(f0: number, delta: number, cap: number): number` — un solo clamp a `[0, cap]`.

- [ ] **Passo 1:** test: `growthFreshnessFactor(0)=0.6`, `(100)=1`, `(50)=0.8`; `injuryFreshnessFactor(100)=0.6`, `(0)=2`, nessun salto fra 29 e 31 (differenza < 0,03); `selectionFreshnessPenalty(30)=3`, `(70)=0`; `momentFreshnessModifier(100)=0.06`; `endOfWeekFreshness(95, 0, 70)=70`, `(10, -30, 90)=0`.
- [ ] **Passo 2:** fallisce. **Passo 3:** implementa. **Passo 4:** verde.
- [ ] **Passo 5:** commit `feat(engine): funzioni della freschezza`.

### Task 3: Crescita senza arrotondamenti, focus a punti invariati, declino pesato

**File:**
- Modify: `packages/engine/src/player/progression.ts` (`growthMultiplier`, `applyGrowth`, `applyDecline`)
- Modify: il calcolo dell'OVR (dove legge `skills`) e la crescita in partita in `player/condition.ts`
- Test: `packages/engine/test/progression.test.ts`

**Interfacce:**
- Consuma: `growthFreshnessFactor` (Task 2).
- Produce:
  - `growthMultiplier(player, week, ctx)` usa `growthFreshnessFactor(condition.energy)` al posto della soglia `lowEnergyThreshold`.
  - `applyLoadGrowth(player, week, load: Load, focus: Skill | undefined, ctx): { player; gains: Partial<Skills> }` — punti = `basePerSession × sessions × multiplier`, distribuiti come oggi sui pesi del ruolo; con focus `focusShare` del totale × (1 − `focusLoss`) sull'abilità scelta, il resto sui pesi.
  - `applyDecline(player, age, loadWeeks: Record<Load, number>, ctx)` — fattore = media dei `loads.*.decline` pesata sulle settimane (tutte zero → 1).
  - Nessun `round2` sulle abilità in tutto il motore; OVR mostrato = `Math.floor`.

- [ ] **Passo 1:** test:
  - ATT 27 anni, abilità 70, potenziale 75, 14 settimane di Equilibrio: guadagno totale > 0 (oggi 0).
  - crescita di 10 settimane una alla volta = crescita di 10 settimane sommate (differenza < 1e-9).
  - focus su `shooting`: somma dei guadagni = 0,9 × somma senza focus; `shooting` riceve il 60% di quella somma.
  - declino a 33 anni con `{push: 52}` = 0,7 × declino con `{balanced: 52}`; con `{rest: 40, push: 12}` = media pesata.
  - OVR con abilità 61,999 → valore mostrato 61 (Focus di revisione 4).
- [ ] **Passo 2:** fallisce. **Passo 3:** implementa; `applyGrowth` vecchio resta finché il Task 7 non lo sostituisce.
- [ ] **Passo 4:** `pnpm test` verde (aggiorna gli snapshot numerici dei test esistenti solo dove il cambio è l'arrotondamento, scrivendolo nel commit).
- [ ] **Passo 5:** commit `feat(engine): crescita continua, focus a punti invariati e declino pesato sul carico`.

### Task 4: Aritmetica della settimana per il carico

**File:**
- Create: `packages/engine/src/season/load.ts`
- Test: `packages/engine/test/load.test.ts`

**Interfacce:**
- Consuma: Task 2, `applyLoadGrowth` (Task 3), `injure`/`rollInjury` di `progression.ts`.
- Produce:
  - `type Load = 'rest' | 'balanced' | 'push'` e `type EffectiveLoad = Load | 'recovery'` (esportati da `types.ts`).
  - `effectiveLoad(player, load: Load): EffectiveLoad` — `recovery` se infortunato.
  - `applyLoadWeek(player, week, load, focus, rng, ctx): { player; rng; gains; injury?; healed: boolean; freshnessDelta: number }` — legge F₀, fa crescita e tiro d'infortunio in seduta con F₀ (`sessionInjury × injuryFreshnessFactor(F₀)`), `healChance` se `recovery`; **non** tocca la freschezza: restituisce `freshnessDelta = load.freshness`.
  - `closeWeekFreshness(player, deltas: number, load: EffectiveLoad, ctx): Player` — applica `endOfWeekFreshness` con il tetto del carico.
  - `formWhenNotPlaying(load: EffectiveLoad, ctx): number` — `loads.*.formNotPlaying`, usato da `applyMatchAftermath` al posto di `formNotPlaying` fisso (−2).

- [ ] **Passo 1:** test:
  - stesso seed, ordine invariato: `applyLoadWeek` due volte da stato uguale → risultato uguale.
  - Equilibrio con F₀ 100 e partita da 90': `closeWeekFreshness` → 90 (tetto), con F₀ 60 → 60 (22 − 22).
  - Spinta da 95 senza partita → 70 (Focus di revisione 3).
  - infortunato con `push` → `effectiveLoad` = `recovery`, nessun guadagno, `healed` possibile.
  - `sessionInjury` 0 su Scarico: 10 000 settimane da seed fisso, zero infortuni in seduta.
  - panchina 4 settimane: forma con Spinta sale di 1 a settimana, con Scarico scende di 2, con Equilibrio resta (prima della deriva verso 50).
- [ ] **Passo 2:** fallisce. **Passo 3:** implementa. **Passo 4:** verde.
- [ ] **Passo 5:** commit `feat(engine): carico settimanale e chiusura della freschezza`.

### Task 5: Vita fuori dal campo e disciplina

**File:**
- Create: `packages/engine/src/season/life.ts`
- Modify: `packages/engine/src/player/condition.ts` (cali di morale passano da un fattore), `packages/engine/src/private/private.ts` (deriva dell'affinità ~riga 569, `applyParty`)
- Test: `packages/engine/test/life.test.ts`

**Interfacce:**
- Produce:
  - `type LifeAction = 'family' | 'leisure' | 'sponsor' | 'party'`.
  - `lifeModifiers(life: LifeAction | undefined, ctx): { moraleLossFactor: number; moraleRecoveryFactor: number; affinityDriftFactor: number }` — default 1/1/1.
  - `applyLifeWeek(state, life, hasMatchThisWeek: boolean, rng, ctx): { state; rng; freshnessDelta; party?: PartyReport; sponsorIncome?: number }` — sponsor: `sum(weeklyIncome) × sponsorWeeksPerWeek`, freschezza −4; serata: riusa `applyParty` con le probabilità di `life.party`.
  - `driftDiscipline(player, ctx): Player` — `toward(discipline, disciplineBase, driftPerWeek)`.
  - Gli effetti di eventi e tratti su `persona.discipline` spostano anche `persona.disciplineBase` dello stesso delta (dove si applicano gli effetti `stat` degli eventi).
  - `applyMatchAftermath` e gli altri punti che tolgono morale (panchina, fuori rosa, sconfitta, infortunio, obiettivo mancato) moltiplicano solo i delta negativi per `moraleLossFactor`; la deriva del morale sotto il riferimento usa `drift × moraleRecoveryFactor`.

- [ ] **Passo 1:** test:
  - Famiglia: sconfitta con −3 → −1,5; vittoria +3 invariata; affinità col partner invariata dopo 14 settimane.
  - Famiglia senza partner: nessun errore, morale protetto uguale (Focus di revisione 5).
  - Svago: morale 40, riferimento 60 → dopo una settimana 44 (20% della distanza), senza svago 42.
  - Sponsor senza contratti: `applyLifeWeek` non dà soldi e non lancia (il blocco è a livello di piano, Task 7).
  - Serata 200 settimane: disciplina converge a base − 20 ± 1; giornali con frequenza ≈ 0,05 (tolleranza statistica dal seed).
  - evento con disciplina −5: valore e base scendono entrambi di 5.
- [ ] **Passo 2:** fallisce. **Passo 3:** implementa. **Passo 4:** `pnpm test` verde.
- [ ] **Passo 5:** commit `feat(engine): azioni fuori dal campo come modificatori del capitolo`.

### Task 6: Freschezza in partita e convocazione

**File:**
- Modify: `packages/engine/src/match/moments.ts` (~riga 311), `packages/engine/src/match/selection.ts` (`selectPlayer`), `packages/engine/src/player/progression.ts` (`injuryChance`)
- Test: `packages/engine/test/match.test.ts`, `risk.test.ts`

**Interfacce:**
- Consuma: `momentFreshnessModifier`, `selectionFreshnessPenalty`, `injuryFreshnessFactor` (Task 2).
- Produce: `injuryChance(base, player, ctx)` = `base × injuryFreshnessFactor(condition.energy)` (niente più `injuryRisk` né `lowEnergyMultiplier`); il punteggio di selezione sottrae la penalità.

- [ ] **Passo 1:** test: probabilità del momento a freschezza 100 − a 0 = 0,12 prima del clamp; selezione con freschezza 30 ha punteggio 3 più basso che a 70 a parità di seed; `injuryChance(0.025, f=100)` = 0,015.
- [ ] **Passo 2–4:** fallisce, implementa, verde (aggiorna i test che fissavano `injuryRisk`).
- [ ] **Passo 5:** commit `feat(engine): la freschezza conta in partita e nella convocazione`.

### Task 7: Cambio di API — `WeekPlan`, salvataggio v4, app e simulatore minimi

Il task più grosso e l'unico che rompe l'API: tutto nello stesso commit perché compili.

**File:**
- Modify: `packages/engine/src/types.ts` (`condition` senza `injuryRisk`; `persona.disciplineBase`; `chapterPlan: WeekPlan | null`; `lastPlan?: WeekPlan`; `seasonLoadWeeks: Record<Load, number>`)
- Modify: `packages/engine/src/season/plan.ts` (`getWeekOptions` → `getPlanOptions`, `planWeek`, `skipToNextMatch`), `season/fastForward.ts` (`repeatPlan`, `setChapterPlan`, `chapterPlanOf`, `prudentChoice` riga 68), `season/week.ts` (`advanceWeek` nell'ordine della spec §5.4b), `player/condition.ts` (`weeklyRecovery` sostituita da `closeWeekFreshness`), `season/*` fine stagione (`applyDecline` con `seasonLoadWeeks`, poi azzerato)
- Modify: `packages/engine/src/save/serialize.ts` (`CURRENT_SAVE_VERSION = 4`, `migrations[3]`)
- Modify: `packages/engine/src/index.ts` (esporta `WeekPlan`, `Load`, `LifeAction`, `getPlanOptions`)
- Modify: `packages/config/*` (togli `actions`, `actionsPerWeek`, vecchio `skipWeekPlan`, `energyWeight`, `lowEnergy*`, `injuryRisk*`; `skipWeekPlanV4` → `skipWeekPlan`)
- Modify: `packages/simulator/src/strategies.ts` (le 4 strategie con la forma nuova, regole del §5.10), `packages/app/src/app/core/game.service.ts`, `pages/week.page.ts` (adattamento minimo: chip di carico e vita senza anteprima, che arriva nel Task 13)
- Test: `engine/test/save.test.ts`, `fastForward.test.ts`, `season.test.ts`, `simulator/test/simulator.test.ts`

**Interfacce:**
- Produce:
  - `interface WeekPlan { load: Load; focus?: Skill; life?: LifeAction }`.
  - `getPlanOptions(state, ctx): { loads: { id: Load; available: boolean }[]; life: { id: LifeAction; available: boolean; reasonKey?: string }[]; forcedLoad?: 'recovery' }`.
  - `planWeek(state, plan: WeekPlan, ctx): { state; report: WeekPlanReport }` con `WeekPlanReport = { plan; effectiveLoad; gains; injury?; healed; party?; sponsorIncome?; moraleProtected: number; lifeSkipped?: LifeAction }`.
  - `setChapterPlan(state, plan: WeekPlan, ctx)` — lancia se `life` non è disponibile **ora** (la UI non conferma).
  - `repeatPlan(state, ctx): WeekPlan` — mai filtri silenziosi: se `life` non è più disponibile la settimana la salta e mette `lifeSkipped` nel report; `planIssues` nel `FastForwardReport` la elenca allo stop.
  - Migrazione v3→v4 come da spec §5.9 (`train_intense`→push; `train_normal`/`train_focus`→balanced con focus; solo `rest`/`physio`→rest; nessun allenamento→balanced; vuoto→`null`; prima azione di vita → `life`; `disciplineBase = max(attuale, media di init.persona.discipline)`; `seasonLoadWeeks` a zero; `injuryRisk` tolto).

- [ ] **Passo 1:** test di migrazione da fixture v3 (aggiungine in `engine/test/fixtures/`): v1 e v3 arrivano a v4; piano `[train_intense, rest]` → `{load:'push'}`; `[train_normal, party]` → `{load:'balanced', life:'party'}`; `[leisure, party]` → `{load:'balanced', life:'leisure'}`; `plannedWeek` conservato, nessun effetto riapplicato (stato del giocatore uguale campo per campo tranne i campi migrati); giocatore infortunato a metà capitolo con serata (Focus di revisione 1).
- [ ] **Passo 2:** test di capitolo: piano con sponsor, contratto che scade alla settimana 3 → le settimane successive hanno `lifeSkipped: 'sponsor'`, nessuna eccezione, `planIssues` allo stop (Focus di revisione 2); serata ripetuta davvero (conta delle settimane con `party` nel report = settimane del capitolo).
- [ ] **Passo 3:** test di determinismo: stesso seed + stesso `WeekPlan` → stessa carriera (test esistente adattato).
- [ ] **Passo 4:** falliscono. **Passo 5:** implementa nell'ordine: tipi → config → `advanceWeek` → `planWeek` → capitolo → salvataggio → simulatore → app.
- [ ] **Passo 6:** `pnpm test`, `pnpm lint` sui file toccati, `pnpm --filter @outstanding/app build` verdi.
- [ ] **Passo 7:** `pnpm sim --careers 1000 --strategy cautious --seed 42`: annota i numeri contro la baseline (il confronto pieno è nel Task 12).
- [ ] **Passo 8:** commit `feat(engine): piano a due binari e salvataggio v4`.

### Task 8: Contenuti — eventi e testi

**File:**
- Modify: gli 8 eventi con `condition.injuryRisk` in `packages/content/data/events/**`
- Modify: `packages/content/src/events.ts` (riga 12, percorsi ammessi), `packages/content/src/check.ts`
- Modify: `packages/app/src/app/pages/event.page.ts` (riga 22, `BAD_WHEN_UP`)
- Modify: `packages/content/data/i18n/it.ui.json` (via `week.actions.*`, nuove `week.load.*`, `week.life.*`, `week.plan.*`)
- Test: `packages/content/test/`, `pnpm content:check`

**Interfacce:**
- Produce: effetti convertiti `{ path: 'condition.energy', delta: -round(riskDelta × riskToFreshness) }`; stessa conversione per eventuali condizioni su `condition.injuryRisk` (soglie invertite). Chiavi: `week.load.{rest,balanced,push,recovery}.{name,desc}`, `week.life.{family,leisure,sponsor,party,none}.{name,desc}`; ogni `desc` scrive il costo (es. Serata: "disciplina −1 a settimana, rischio giornali e multe").

- [ ] **Passo 1:** test: il validatore rifiuta un evento con `condition.injuryRisk`; nessuna chiave `week.actions.*` rimasta; tutte le chiavi `week.load.*`/`week.life.*` esistono.
- [ ] **Passo 2–4:** fallisce, converti con uno script una tantum (non versionato), verde con `pnpm content:check`.
- [ ] **Passo 5:** commit `content: eventi e testi per freschezza, carico e vita`.

### Task 9: Anteprima del piano

**File:**
- Create: `packages/engine/src/season/preview.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/preview.test.ts`

**Interfacce:**
- Consuma: `applyLoadWeek`, `applyLifeWeek` nella parte deterministica, funzioni del Task 2, calendario del capitolo.
- Produce: `previewPlan(state, plan: WeekPlan, ctx): PlanPreview` con
  `PlanPreview = { weekly: { freshnessDelta; gains: Partial<Skills>; lifeEffects: { moneyPerWeek?; popularityPerWeek?; disciplinePerWeek? } };
  chapter: { weeks; matches; freshnessAtMatches: number[] /* ipotesi titolare 90' */; momentsModifier: number; injuryChance: number; riskBand: 'low'|'medium'|'high'; benchRisk: 'none'|'some'; nextPoint?: { skill: Skill; weeks: number }; pace: 'fast'|'normal'|'slow'|'stopped'; paceReason: 'age'|'discipline'|'freshness'; declineFactor?: number; gossipChance?: number; fineChance?: number; moneyTotal?: number } }`.
  Probabilità del capitolo = `1 − (1 − p)^settimane`. Il potenziale non compare mai.

- [ ] **Passo 1:** test:
  - su 3 seed fissi, settimana senza eventi né partita: `weekly.gains` e `freshnessDelta` = quelli di `planWeek` al centesimo.
  - settimana con partita da 90' simulata a minuti forzati: freschezza di fine settimana = anteprima.
  - Spinta da 95: `freshnessAtMatches[0]` ≤ 70 (Focus di revisione 3).
  - Serata in 14 settimane con `gossipChance` 0,05 → `gossipChance` del capitolo = 1 − 0,95¹⁴.
  - over 31 con Spinta: `declineFactor` = 0,7 e `pace` = `'stopped'`.
  - `previewPlan` non modifica lo stato (stesso riferimento e `rngState` uguale dopo la chiamata).
- [ ] **Passo 2–4:** fallisce, implementa, verde.
- [ ] **Passo 5:** commit `feat(engine): anteprima del piano`.

### Task 10: Registro del piano nel tratto

**File:**
- Modify: `packages/engine/src/types.ts` (`ChapterLog.plan?`), dove `chapter.stretch` e `chapter.log` si aggiornano (`season/fastForward.ts`, `season/goals.ts`)
- Test: `packages/engine/test/fastForward.test.ts`

**Interfacce:**
- Produce: `ChapterLog.plan?: { skillsAtStart: Skills; freshnessAtMatches: number[]; moraleProtected: number; sponsorIncome: number; popularity: number; gossip: number; fines: number; pointsGained: Partial<Record<Skill, number>> }`, aggiunto da ogni `planWeek`, facoltativo (vecchi salvataggi senza).

- [ ] **Passo 1:** test: dopo un tratto di 6 settimane con Famiglia e 2 sconfitte, `stretch.plan.moraleProtected = 2`; `pointsGained.shooting` = differenza di `floor` fra inizio e fine.
- [ ] **Passo 2–4:** fallisce, implementa, verde.
- [ ] **Passo 5:** commit `feat(engine): registro del piano nel tratto e nel capitolo`.

### Task 11: Simulatore — piani fissi e criteri

**File:**
- Modify: `packages/simulator/src/cli.ts` (opzione `--plan <load>+<life|none>[+<skill>]`), `run.ts`, `strategies.ts`, `metrics.ts`
- Modify: `packages/config/data/simulator.json` (`secondsPer.planPreview`, ipotesi 6 s per capitolo)
- Test: `packages/simulator/test/simulator.test.ts`, script `sim:criterion`

**Interfacce:**
- Produce: `fixedPlanStrategy(plan: WeekPlan): Strategy` che usa la logica di momenti, offerte ed eventi di `contextual`; regole del piano di `contextual` dalla spec §5.10, scritte in `strategies.ts` e congelate prima del Task 12; `criteria(results): { id: 1|2|3|4|5; pass: boolean; detail: string }[]`.

- [ ] **Passo 1:** test: `--plan push+none` gioca sempre Spinta senza vita (conta nel report); `fixedPlanStrategy` sceglie nei momenti come `contextual` a parità di stato.
- [ ] **Passo 2:** 4 test mirati del criterio 4, uno per azione di vita, su scenari costruiti: morale 35 dopo 3 sconfitte (Svago migliore), partner con affinità 30 (Famiglia), cassa 0 con sponsor (Sponsor), popolarità a 2 punti dalla soglia di un'offerta (Serata); "migliore" = valore misurato su 200 seed entro il capitolo.
- [ ] **Passo 3–4:** fallisce, implementa, verde.
- [ ] **Passo 5:** commit `feat(sim): piani fissi e criteri della settimana leggibile`.

### Task 12: Taratura

**File:**
- Modify: `packages/config/data/progression.json`, `match.json` (solo numeri)
- Create: `reports/settimana-leggibile/taratura.md`

- [ ] **Passo 1:** `pnpm sim --careers 5000 --seed 42` con `cautious`, `contextual` e i piani fissi `rest|balanced|push` × `none|family|leisure|sponsor|party`.
- [ ] **Passo 2:** confronta con la baseline (Task 0) e i criteri 1–5; tocca un parametro alla volta, nell'ordine `sessions` → `freshnessCap` → `injuries.freshnessCurve` → `selection.freshness*` → vita; annota ogni giro nel report.
- [ ] **Passo 3:** fatto quando: criteri 1–5 verdi, stagione 20–30 minuti e carriera 6–8 ore con `cautious`, leggende 1–5%.
- [ ] **Passo 4:** commit `chore(config): taratura della settimana leggibile` con i numeri chiave nel corpo.

### Task 13: Scheda del piano (app)

**File:**
- Modify: `packages/app/src/app/pages/week.page.ts` (righe 176–231, `planSummary` ~987), `core/game.service.ts` (`previewPlan`), `core/chapter-view.ts`
- Modify: `docs/design-system.md` se servono componenti nuovi (chip di carico, barra con tetto)
- Test: `packages/app/test/chapter-view.test.ts` (+ nuovo `plan-sheet.test.ts` per la vista)

**Interfacce:**
- Consuma: `getPlanOptions`, `previewPlan`, `setChapterPlan`.
- Produce: vista pura `planSheetView(preview: PlanPreview, plan: WeekPlan): PlanSheetView` in `core/plan-sheet-view.ts` con le righe del bozzetto della spec §5.7 già tradotte in chiavi e numeri; il componente la mostra.

- [ ] **Passo 1:** skill `frontend-design` con il bozzetto della spec §5.7 e i token esistenti.
- [ ] **Passo 2:** test della vista: rischio "basso" sotto `riskBands.medium`; barra della freschezza con tacca al tetto del carico; testo Serata con la probabilità del capitolo arrotondata ("circa 1 su 2"); infortunato → carico mostrato "Recupero" e chip bloccati; sponsor non disponibile → chip disattivato con motivo; anteprima "se titolare".
- [ ] **Passo 3–4:** fallisce, implementa vista e componente (aggiornamento 150–250 ms, `prefers-reduced-motion`, 44 px, lettore di schermo con l'effetto principale), verde.
- [ ] **Passo 4b:** nel profilo la disciplina diventa visibile (valore e base, con la riga "torna verso {base}"); test della vista nel profilo.
- [ ] **Passo 5:** prova nel browser a 390 px (skill `webapp-testing` o `game-playtest`), schermate in scratchpad.
- [ ] **Passo 6:** commit `feat(app): scheda del piano con anteprima`.

### Task 14: "Dal piano", fine capitolo e +1

**File:**
- Modify: `packages/app/src/app/pages/week.page.ts` (scheda capitolo, foglio della prima pagina), `core/chapter-view.ts`, effetti sonori zzfx esistenti
- Test: `packages/app/test/chapter-view.test.ts`

**Interfacce:**
- Consuma: `ChapterLog.plan` (Task 10), `planIssues` (Task 7).
- Produce: `planStretchLine(log: ChapterLog): string[]` (es. "Tiro 61 → 62", "freschezza 74 → 66", "morale protetto 2 volte"); `chapterHint(log): { key; values } | null` (es. "stanco a 3 partite su 9" sotto 50 di freschezza); `pointFlashes(log): Skill[]`, una per abilità per stop.

- [ ] **Passo 1:** skill `frontend-design` e `game-feel` (juice solo sul +1).
- [ ] **Passo 2:** test: tratto senza `plan` → nessuna riga (vecchi salvataggi); `pointFlashes` non ripete un'abilità già lampeggiata nello stesso stop; `planIssues` con sponsor scaduto → riga di avviso.
- [ ] **Passo 3–4:** fallisce, implementa, verde; prova nel browser.
- [ ] **Passo 5:** commit `feat(app): risultati del piano in home e a fine capitolo`.

### Task 15: Chiusura del blocco

- [ ] **Passo 1:** `pnpm test`, `pnpm content:check`, build app, `pnpm sim:criterion` verdi; review `~/.ai/shell/ai-codex standard` sul diff dal Task 0.
- [ ] **Passo 2:** `CHANGELOG.md` (anche: serate ora davvero nel piano, salvataggi v4), `.claude/memory/` (nuovo `settimana-leggibile.md` con numeri tarati e scelte), `docs/design/` se descrive le 9 azioni.
- [ ] **Passo 3:** commit `docs: settimana leggibile`. Push su `ciro-dev` solo con conferma dell'utente.
