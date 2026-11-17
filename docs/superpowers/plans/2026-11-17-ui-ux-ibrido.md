# UI e UX ibrido spinto: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare l'app a "giornale sportivo + strato pixel" e applicare le sei correzioni di UX al giro di gioco.

**Architecture:** Si estendono token e classi `o-*` del tema con uno strato pixel (font, cornici, icone,
stemmi e maglie a griglia). Le regole nuove che non dipendono da Angular (sblocchi della barra,
icone, griglie degli stemmi, guida) stanno in file puri in `packages/app/src/app/core/` e `ui/`,
provati con Vitest. Il motore aggiunge solo due dati facoltativi: le voci del voto e la conseguenza
di ogni opzione di un momento.

**Tech Stack:** Angular + Ionic, CSS custom properties, SVG `crispEdges`, `@fontsource/pixelify-sans`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-ui-ux-ibrido-design.md`

## Global Constraints

- Font pixel solo da 20 px in su; testi lunghi in Inter; titoli in Barlow Condensed.
- Cornice pixel: angoli a gradino di 4 px, bordo pieno 2 px, ombra piena spostata di 4 px, nessuna sfocatura.
- Pulsante principale: oro, si abbassa di 2 px al tocco, 150 ms.
- Animazioni 150–300 ms, spente con `prefers-reduced-motion`.
- Area di tocco minima 44 px; contrasto AA; tema scuro predefinito e chiaro funzionante.
- Nessun testo nel codice: chiavi in `packages/content/data/i18n/it.ui.json` (prefisso `ui.`).
- Font OFL inclusi con `@fontsource`, registrati in `ASSETS.md`.
- Motore puro: nessun import da `app`, nessun `Math.random`/`Date.now`; nuovi campi facoltativi, con test.
- Ogni schermata passa dalla skill `frontend-design` prima del codice.
- Commit in italiano (Conventional Commits), percorsi espliciti, nessun riferimento all'AI, branch `ciro-dev`, niente push.

## Review Focus

1. Svincolato (senza club): deve vedere Mercato subito, altrimenti non può trovare squadra → test in Task 4.
2. Salvataggio vecchio a metà carriera: tutte le voci già sbloccate, nessuna raffica di "Novità" → test in Task 4.
3. Voto con decimale ("6,5") e segni ("+1", "−0,5", "%"): il font pixel deve avere virgola, più, meno tipografico e percento → controllo glifi in Task 1, formattazione con test in Task 6.
4. Tema chiaro: cornici e ombre piene restano visibili su sfondo chiaro → screenshot obbligatorio in Task 1 e Task 10.
5. Giocatore in modalità testo (senza scene): le opzioni del momento mostrano comunque percentuale e conseguenza → test in Task 6 sul dato del motore, screenshot in Task 10.

---

## Ondata 1: sistema

### Task 1: Font pixel, token e classi pixel

**Files:**
- Modify: `packages/app/package.json`, `packages/app/src/styles.css`, `packages/app/src/theme/tokens.css`, `packages/app/src/theme/components.css`
- Modify: `ASSETS.md`, `docs/design-system.md`

**Interfaces:**
- Produces: token `--o-font-pixel`, `--o-px-step: 4px`, `--o-px-border: 2px`, `--o-px-shadow` (colore), classi `.o-px` (cornice), `.o-px--paper` (cornice nei colori della carta), `.o-num` (numero in font pixel, min 20 px), `.o-btn` aggiornato a cornice pixel, `.o-enter-steps` (entrata a scatti).

- [ ] **Step 1:** `pnpm --filter @outstanding/app add @fontsource/pixelify-sans`; import di `latin-400.css` e `latin-700.css` in `styles.css`.
- [ ] **Step 2:** Controllo glifi: aprire in Chrome headless una pagina di prova (scratchpad) con `0123456789 , + − % € s.v.` in Pixelify Sans a 24 px e fare screenshot; se manca `−` (U+2212) o `€`, usare `-` ed `EUR` nei numeri pixel e annotarlo in `docs/design-system.md`.
- [ ] **Step 3:** Token e classi. Cornice con `clip-path: polygon(...)` a gradini di `--o-px-step` sui quattro angoli; bordo con `box-shadow: inset 0 0 0 var(--o-px-border) <bordo>`; ombra piena con `filter: drop-shadow(4px 4px 0 var(--o-px-shadow))` sul contenitore (il clip-path taglia le box-shadow esterne). Valori di `--o-px-shadow`: scuro `#04100A`, chiaro `#A9BFA9`. `.o-btn:active`: `transform: translate(2px, 2px)` e ombra 2 px. `.o-enter-steps`: `animation-timing-function: steps(3)`, 240 ms, nulla con `prefers-reduced-motion`.
- [ ] **Step 4:** Applicare `.o-px` a `.o-card`, `.o-choice`, `.o-paper` (variante carta), `.o-chip` senza cambiare l'HTML delle pagine; `.o-number` usa `--o-font-pixel` solo dove la dimensione è ≥ 20 px (classe `.o-number.big` e numeri hero).
- [ ] **Step 5:** `ASSETS.md`: Pixelify Sans, autore, SIL OFL 1.1, pacchetto `@fontsource/pixelify-sans`. `docs/design-system.md`: sezione "Strato pixel" con token, regole del §4 della spec e tabella dei tre strati.
- [ ] **Step 6:** Verifica: `pnpm typecheck && pnpm test && pnpm exec eslint packages/app/src && pnpm --filter @outstanding/app build` verdi; screenshot a 390 px di Settimana in tema scuro e chiaro (harness nello scratchpad o `pnpm --filter app start` + Chrome headless): cornici visibili in entrambi.
- [ ] **Step 7:** Commit `feat(app): strato pixel nel tema con font, cornici e numeri`.

### Task 2: Icone pixel

**Files:**
- Create: `packages/app/src/app/ui/px-icons.ts`, `packages/app/src/app/ui/px-icon.component.ts`
- Test: `packages/app/test/px-icons.test.ts`

**Interfaces:**
- Produces: `type PxIconName = 'week' | 'profile' | 'market' | 'standings' | 'career' | 'form' | 'energy' | 'morale' | 'cash' | 'news' | 'match' | 'press' | 'new'`; `PX_ICONS: Record<PxIconName, readonly string[]>` (16 righe di 16 caratteri: `.` vuoto, `#` colore corrente, `o` contorno scuro, `+` luce); `pxRuns(rows: readonly string[]): { x: number; y: number; w: number; c: '#' | 'o' | '+' }[]` (unisce i pixel orizzontali uguali); componente `<app-px-icon [name] [size]="16|24|32">` che disegna `<rect>` con `shape-rendering="crispEdges"`, `#` = `currentColor`.

- [ ] **Step 1: Test**
```ts
it('ogni icona è 16×16 con soli caratteri ammessi', () => {
  for (const rows of Object.values(PX_ICONS)) {
    expect(rows).toHaveLength(16);
    for (const r of rows) expect(r).toMatch(/^[.#o+]{16}$/);
  }
});
it('pxRuns unisce i pixel adiacenti uguali', () => {
  expect(pxRuns(['##.o', '....'])).toEqual([{ x: 0, y: 0, w: 2, c: '#' }, { x: 3, y: 0, w: 1, c: 'o' }]);
});
```
- [ ] **Step 2:** `pnpm --filter @outstanding/app exec vitest run test/px-icons.test.ts` → FAIL (modulo mancante).
- [ ] **Step 3:** Disegnare le 13 griglie (casa, figurina, frecce di scambio, podio, coppa, cuore che batte, fulmine, faccina, moneta, giornale, pallone, microfono, stella "novità") e il componente.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `feat(app): icone pixel disegnate dal codice`.

### Task 3: Stemmi e maglie in pixel

**Files:**
- Create: `packages/app/src/app/scenes/pix.ts` (spostare `Pix`, `EMPTY`, `OUTLINE`, `shade`, `css` da `pixel-art.ts`, che li riesporta), `packages/app/src/app/ui/pixel-crest.ts`
- Modify: `packages/app/src/app/ui/crest.component.ts`, `packages/app/src/app/ui/kit.component.ts`
- Test: `packages/app/test/pixel-crest.test.ts`

**Interfaces:**
- Consumes: `Crest`, `Kit` da `@outstanding/engine`; `pxRuns` non serve (lavora su `Pix`).
- Produces: `crestPixels(crest: Crest, symbol: Uint8Array /* maschera 10×10, 1 = pieno */): Pix` (griglia 22×26, forma shield/circle/oval, contorno `OUTLINE`, simbolo nel colore secondario centrato in alto, iniziali con `glyphs` sotto se la griglia lo permette); `kitPixels(kit: Kit): Pix` (griglia 20×18, motivi `plain`/`vertical`/`horizontal`/`sash` come in `KitPattern`); `pixRects(p: Pix): { x: number; y: number; w: number; fill: string }[]`; `symbolMask(path: string): Uint8Array` nel componente (canvas del browser con `Path2D`, scala a 10×10, soglia alfa 50%; consentito nell'app, non nel motore).

- [ ] **Step 1: Test**
```ts
const crest: Crest = { shape: 'shield', primary: '#1d4e89', secondary: '#f2b830', symbol: 'star', initials: 'RM' };
const full = new Uint8Array(100).fill(1);
it('è deterministico', () => expect(crestPixels(crest, full).data).toEqual(crestPixels(crest, full).data));
it('scudo e cerchio danno griglie diverse', () => {
  expect(crestPixels(crest, full).data).not.toEqual(crestPixels({ ...crest, shape: 'circle' }, full).data);
});
it('ha il contorno e usa i due colori', () => {
  const colors = new Set(crestPixels(crest, full).data);
  expect(colors).toContain(OUTLINE); expect(colors).toContain(0x1d4e89); expect(colors).toContain(0xf2b830);
});
it('pixRects copre tutti i pixel pieni', () => {
  const p = kitPixels({ primary: '#ffffff', secondary: '#000000', pattern: 'vertical' });
  const filled = [...p.data].filter((c) => c !== EMPTY).length;
  expect(pixRects(p).reduce((s, r) => s + r.w, 0)).toBe(filled);
});
```
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Spostare `Pix` in `pix.ts` senza cambiare comportamento (i test delle scene esistenti devono restare verdi); implementare `pixel-crest.ts`.
- [ ] **Step 4:** `CrestComponent` e `KitComponent` disegnano `<rect>` da `pixRects` con `shape-rendering="crispEdges"`; stessi input (`crest`, `size`, `label`), stessa accessibilità. Maschere dei simboli in cache per id.
- [ ] **Step 5:** `pnpm test && pnpm typecheck` verdi; screenshot di Settimana e Classifica: stemmi nitidi a 26, 40 e 64 px.
- [ ] **Step 6:** Commit `feat(app): stemmi e maglie in pixel`.

### Task 4: Barra in basso a gradini con "Novità"

**Files:**
- Create: `packages/app/src/app/core/unlocks.ts`
- Modify: `packages/app/src/app/ui/tab-bar.component.ts`, `packages/content/data/i18n/it.ui.json`
- Test: `packages/app/test/unlocks.test.ts`

**Interfaces:**
- Consumes: `GameState`, `getTransferWindow` da `@outstanding/engine`; `<app-px-icon>` (Task 2); `TabId` da `tab-bar.component.ts`.
- Produces: `visibleTabs(s: GameState, offers: number): TabId[]` (ordine fisso `week, profile, market, standings, career`); `newTabs(visible: TabId[], seen: TabId[] | null): { tabs: TabId[]; seen: TabId[] }` (con `seen === null`, cioè nessun dato salvato, tutto ciò che è visibile conta come già visto); salvataggio di `seen` per slot nello `StorageService` con chiave `unlocks.<slot>`.

Regole: `week`, `profile`, `standings` sempre. `market` se `getTransferWindow(s) !== null`, oppure `!s.player.clubId`, oppure `offers > 0`, oppure `s.player.history.length > 0`, oppure `seen` lo contiene già (non sparisce più). `career` se `s.player.history.length > 0`.

- [ ] **Step 1: Test**
```ts
it('all'inizio solo Settimana, Profilo e Classifica', () =>
  expect(visibleTabs(midSeasonRookie, 0)).toEqual(['week', 'profile', 'standings']));
it('lo svincolato vede subito il Mercato', () =>
  expect(visibleTabs({ ...rookie, player: { ...rookie.player, clubId: undefined } }, 0)).toContain('market'));
it('Carriera dopo la prima stagione', () => expect(visibleTabs(afterOneSeason, 0)).toContain('career'));
it('salvataggio vecchio: niente raffica di novità', () =>
  expect(newTabs(['week', 'profile', 'market', 'standings', 'career'], null).tabs).toEqual([]));
it('annuncia una sola volta', () => {
  const first = newTabs(['week', 'profile', 'market', 'standings'], ['week', 'profile', 'standings']);
  expect(first.tabs).toEqual(['market']);
  expect(newTabs(['week', 'profile', 'market', 'standings'], first.seen).tabs).toEqual([]);
});
```
(Gli stati di prova si costruiscono con `newCareer` del motore e un seme fisso; `midSeasonRookie` è una settimana fuori dalle finestre.)
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Implementare `unlocks.ts`; nella barra griglia a `visible.length` colonne, icone `<app-px-icon>` a 24 px, etichetta della voce nuova con stella "novità" e un riquadro "Novità: {tab}" (chiavi `ui.unlock.title`, `ui.unlock.tab.<id>`) mostrato una volta, chiuso al tocco.
- [ ] **Step 4:** Test → PASS; `pnpm test` intero verde (il test delle chiavi i18n deve trovare le nuove chiavi).
- [ ] **Step 5:** Aggiornare `docs/design-system.md` (barra a gradini, icone pixel). Commit `feat(app): barra in basso a gradini con annuncio delle novità`.

---

## Ondata 2: giro di gioco

### Task 5: Voci del voto nel motore

**Files:**
- Modify: `packages/engine/src/match/match.ts` (`MatchReport`, `finishMatch`)
- Test: `packages/engine/test/match.test.ts`

**Interfaces:**
- Produces: `export type RatingPartKey = 'base' | 'moments' | 'goals' | 'assists' | 'result' | 'cleanSheet' | 'conceded' | 'day'`; `MatchReport.ratingParts?: { key: RatingPartKey; delta: number }[]`, presente solo quando `rating !== null`. `base` sempre presente; le altre solo se `delta !== 0`; `day` è il rumore `rng.normal`. Nessun cambio di `saveVersion` (campo facoltativo, non letto dal motore).

- [ ] **Step 1: Test**
```ts
it('le voci del voto sommano al voto prima di arrotondare e limitare', () => {
  for (const seed of [1, 2, 3, 42]) {
    const r = playedReport(seed); // partita giocata con autoDecider, giocatore titolare
    if (r.rating === null) continue;
    const sum = r.ratingParts!.reduce((s, p) => s + p.delta, 0);
    expect(clamp(roundTo(sum, cfg.step), cfg.min, cfg.max)).toBe(r.rating);
    expect(r.ratingParts![0]).toEqual({ key: 'base', delta: cfg.base });
  }
});
it('senza voto niente voci', () => expect(benchReport().ratingParts).toBeUndefined());
it('stesso seme, stesse voci', () => expect(playedReport(7).ratingParts).toEqual(playedReport(7).ratingParts));
```
- [ ] **Step 2:** `pnpm --filter @outstanding/engine exec vitest run test/match.test.ts` → FAIL.
- [ ] **Step 3:** In `finishMatch` costruire le voci dagli stessi termini di `raw` (stesso ordine di chiamata di `rng.normal`, così il determinismo delle carriere esistenti non cambia).
- [ ] **Step 4:** `pnpm test` intero verde (i test di determinismo e del simulatore non devono cambiare numeri).
- [ ] **Step 5:** Commit `feat(engine): voci che compongono il voto in pagella`.

### Task 6: Conseguenza delle opzioni e momento chiave

**Files:**
- Modify: `packages/engine/src/match/moments.ts` (`KeyMomentOption`) e il punto in cui le opzioni vengono costruite
- Modify: `packages/app/src/app/pages/match.page.ts` (blocco opzioni, righe ~181–205), `packages/app/src/app/core/text.ts`, `it.ui.json`
- Test: `packages/engine/test/match.test.ts`, `packages/app/test/texts.test.ts`

**Interfaces:**
- Produces: `export type Consequence = 'goal' | 'assist' | 'teamGoal' | 'rating' | 'goalAgainst' | 'lost'`; `KeyMomentOption.onSuccess: Consequence`, `KeyMomentOption.onFailure: Consequence`; `consequenceOf(outcome: MomentOutcome, success: boolean): Consequence` esportata dal motore. Regole: successo → `goalFor` e `by: 'self'` → `goal`; `by: 'assist'` → `assist`; `by: 'team'` → `teamGoal`; altrimenti `rating`. Fallimento → `goalAgainst` definito e > 0 → `goalAgainst`; altrimenti `lost`.
- Produces (app): `signedRating(delta: number): string` in `text.ts` (`+1`, `−0,5`, `0`; segno meno U+2212 o `-` secondo l'esito del controllo glifi del Task 1).

- [ ] **Step 1: Test motore**
```ts
it('ogni opzione dichiara cosa succede se va e se no', () => {
  const m = firstMoment(42);
  for (const o of m.options) {
    expect(['goal', 'assist', 'teamGoal', 'rating']).toContain(o.onSuccess);
    expect(['goalAgainst', 'lost']).toContain(o.onFailure);
  }
});
it('consequenceOf', () => {
  expect(consequenceOf({ rating: 1, goalFor: 0.6, by: 'self' }, true)).toBe('goal');
  expect(consequenceOf({ rating: -0.5, goalAgainst: 0.3 }, false)).toBe('goalAgainst');
  expect(consequenceOf({ rating: -0.5 }, false)).toBe('lost');
});
```
- [ ] **Step 2: Test app** in `texts.test.ts`: per ogni `Consequence` esiste `ui.match.consequence.<c>`; per ogni `RatingPartKey` esiste `ui.match.ratingPart.<k>`; `signedRating(1) === '+1'`, `signedRating(-0.5)` termina con `0,5` e inizia col segno meno scelto, `signedRating(0) === '0'`.
- [ ] **Step 3:** Test → FAIL; implementare motore e `signedRating`; test → PASS.
- [ ] **Step 4:** Skill `frontend-design` sul blocco opzioni: scheda `.o-choice.o-px` con nome, percentuale in `.o-num` (≥ 28 px) a destra, barra della probabilità, sotto una riga `Se va: {success} · Se no: {failure}` (chiave `ui.match.consequenceLine`). Scena animata sopra, opzioni nella metà bassa. Vale uguale in modalità testo.
- [ ] **Step 5:** `pnpm test && pnpm typecheck && pnpm content:check` verdi. Commit `feat(match): conseguenza di ogni scelta nel momento chiave`.

### Task 7: Pagella che spiega il voto

**Files:**
- Modify: `packages/app/src/app/pages/match.page.ts` (sezione `.o-paper` della pagella, righe ~240–260), `it.ui.json`

**Interfaces:**
- Consumes: `MatchReport.ratingParts` (Task 5), `signedRating` (Task 6), `formatRating`.

- [ ] **Step 1:** Skill `frontend-design`. Carta di giornale con occhiello "Pagella", voto in `.o-num` a 72 px dentro un riquadro pixel, riga di commento in corsivo; sotto, "scontrino": una riga per voce (`ui.match.ratingPart.<key>` a sinistra, `signedRating(delta)` a destra, verde se > 0, rosso se < 0, filetto tratteggiato fra le righe) e una riga finale "Voto" con `formatRating(rating)`. Se `ratingParts` manca (s.v., panchina) si mostra solo il commento come oggi.
- [ ] **Step 2:** `pnpm test` (chiavi) e `pnpm typecheck` verdi; screenshot pagella scuro/chiaro con un voto decimale.
- [ ] **Step 3:** Commit `feat(app): pagella con le voci del voto`.

### Task 8: Settimana come plancia e modalità partita

**Files:**
- Modify: `packages/app/src/app/core/settings.service.ts`, `packages/app/src/app/pages/week.page.ts`, `packages/app/src/app/pages/match.page.ts`, `packages/app/src/app/pages/settings.page.ts`, `it.ui.json`
- Create: `packages/app/src/app/core/match-mode.ts`
- Test: `packages/app/test/services.test.ts`

**Interfaces:**
- Produces: `export const MATCH_MODES = ['full', 'sim'] as const` (commento: `'quick'` arriva con M18); `type MatchMode`; `parseMatchMode(raw: string | null): MatchMode` (predefinito `'full'`); `SettingsService.matchMode = signal<MatchMode>`; rotta `/partita?mode=sim` fa partire `simulate()` all'apertura.

- [ ] **Step 1: Test**: `parseMatchMode(null) === 'full'`, `parseMatchMode('sim') === 'sim'`, `parseMatchMode('boh') === 'full'`.
- [ ] **Step 2:** Test → FAIL; implementare; test → PASS.
- [ ] **Step 3:** Skill `frontend-design` su Settimana. Ordine: testata (club, settimana in `.o-num`, soldi in chip con icona `cash`), **scheda partita** in cima (stemmi pixel 48 px, competizione, forza avversario, due chip `Completa`/`Simula` con il predefinito preselezionato, pulsante oro "Gioca"), condizione con icone pixel, piano della settimana compatto, notizie come striscia di prima pagina, finestra di mercato. Il pulsante "Gioca" porta a `/partita` (con `?mode=sim` se scelto) quando la settimana ha la partita; restano i flussi esistenti di `act()`, `skip()` e `fastForward()`, con l'avanti veloce come pulsante secondario in fondo.
- [ ] **Step 4:** In Impostazioni, scelta "Modalità partita predefinita" accanto alla modalità di gioco esistente.
- [ ] **Step 5:** `pnpm test && pnpm typecheck` verdi; screenshot Settimana con e senza partita, scuro e chiaro, e da svincolato.
- [ ] **Step 6:** Commit `feat(app): settimana come plancia con partita in primo piano`.

### Task 9: Guida corta prima della prima partita

**Files:**
- Modify: `packages/app/src/app/core/tutorial.ts` (`TIPS`)
- Test: `packages/app/test/tutorial.test.ts`

**Interfaces:**
- Produces: nuovo `TIPS` nell'ordine `week.welcome: []`, `week.cta: ['week.welcome']`, `event.choice: []`, `match.moments: []`, `match.rating: []`, `week.condition: ['match.rating']`, `week.plan: ['week.condition']`, `match.pre: ['match.rating']`, `week.tabs: ['week.plan']`, `week.done: ['week.tabs']`.

- [ ] **Step 1: Test** (sostituisce le attese vecchie su `week.condition`):
```ts
it('prima della prima partita al massimo 3 note fra settimana e partita', () => {
  const fresh: TutorialData = { slot: 1, seen: [] };
  const beforeMatch = ['week.welcome', 'week.cta', 'week.condition', 'week.plan', 'match.pre', 'match.moments'] as const;
  const reachable = beforeMatch.filter((id) =>
    tipVisible(fresh, 1, id) || tipVisible({ slot: 1, seen: ['week.welcome'] }, 1, id));
  expect(reachable).toEqual(['week.welcome', 'week.cta', 'match.moments']);
});
it('condizione e piano arrivano dopo la prima pagella', () => {
  expect(tipVisible({ slot: 1, seen: ['week.welcome', 'week.cta', 'match.moments', 'match.rating'] }, 1, 'week.condition')).toBe(true);
});
```
- [ ] **Step 2:** Test → FAIL; aggiornare `TIPS`; aggiornare il testo di `week.welcome` (in `it.ui.json`) perché nomini la partita come prima cosa da fare; test → PASS insieme al test esistente sull'ordine delle dipendenze.
- [ ] **Step 3:** Commit `feat(app): guida più corta prima della prima partita`.

### Task 10: Evento come prima pagina, verifica dell'ondata e prova su iPhone

**Files:**
- Modify: `packages/app/src/app/pages/event.page.ts`, `it.ui.json`, `docs/design-system.md`, `CHANGELOG.md`, `.claude/memory/` (nota `ui-ibrido.md` + indice)

- [ ] **Step 1:** Skill `frontend-design` su Evento: prima pagina più grande (testata, occhiello, titolo 40–46 px), scelte come pulsanti pixel su carta (`.o-px--paper`), esito come "edizione successiva": ritaglio di carta ruotato di 1° (0° con "riduci movimento" non serve: è statico) con occhiello `ui.event.nextEdition` e titolo breve; sotto, gli stessi effetti che la pagina mostra oggi, uno per riga, con il valore firmato (`+5`, `−3`) in `.o-num` se ≥ 20 px, altrimenti in Barlow Condensed. Nessun dato nuovo dal motore.
- [ ] **Step 2:** Verifica completa: `pnpm typecheck && pnpm test && pnpm content:check && pnpm exec eslint packages/app/src packages/engine/src` verdi; `pnpm sim --careers 200 --strategy cautious --seed 42` con gli stessi numeri di prima (il motore non cambia esiti).
- [ ] **Step 3:** Screenshot 390 px scuro e chiaro di Settimana, Partita (momento in modalità testo e animata), Pagella, Evento; controllo "riduci movimento".
- [ ] **Step 4:** Build iOS e installazione sull'iPhone 15 (`pnpm --filter @outstanding/app build`, `npx cap sync ios`, `xcodebuild` con destinazione `id=00008120-000A794204C14032`, `xcrun devicectl device install app`, `launch it.outstanding.calcio`).
- [ ] **Step 5:** `CHANGELOG.md` (sezione "Interfaccia ibrida"), `docs/design-system.md` aggiornato, nota di memoria. Commit `feat(app): notizie come prima pagina` e `docs: design system ibrido e changelog`.
- [ ] **Step 6:** **Fermarsi**: chiedere all'utente di provare sull'iPhone e approvare prima dell'ondata 3.

---

## Ondata 3: le altre schermate (dopo l'approvazione)

Per ogni task: skill `frontend-design`, solo classi e token del sistema (nessun colore nuovo), icone
pixel dove c'è un'icona di stato o di sezione, numeri ≥ 20 px in `.o-num`, screenshot scuro e chiaro,
`pnpm test && pnpm typecheck` verdi, un commit `feat(app): stile ibrido per <schermate>`.

### Task 11: Profilo, Carriera, Stagione, Classifica, Fine carriera
**Files:** `pages/profile.page.ts`, `career.page.ts`, `season.page.ts`, `standings.page.ts`, `end.page.ts`, `ui/stat-bar.component.ts`
Barre delle abilità a segmenti pixel (10 tacche), OVR e punteggio in `.o-num`, fine stagione e fine carriera come prime pagine.

### Task 12: Mercato, Vita, Patrimonio, Vita privata
**Files:** `pages/market.page.ts`, `life.page.ts`, `wealth.page.ts`, `private.page.ts`
Offerte come lettere su carta con cornice pixel, cifre in `.o-num`; vignette dentro cornice pixel.

### Task 13: Social, Conferenza, Crea, Avvio, Impostazioni, Editor, Aspetto
**Files:** `pages/social.page.ts`, `press.page.ts`, `create.page.ts`, `start.page.ts`, `settings.page.ts`, `editor.page.ts`, `look.page.ts`
Avvio con titolo del gioco in pixel grande e stemma; avatar vettoriale dentro cornice pixel.
Chiusura: CHANGELOG, design system, memoria, build e installazione su iPhone.
