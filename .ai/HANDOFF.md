# Handoff

## Stato
Due sessioni in parallelo oggi, tutto pubblicato su `origin/ciro-dev` (push fino a `eccba0f`).
- Home a capitoli (`d236087`) e poi riordinata in tre strati, con la Bacheca (`5793c2d`): stato e avvisi compatti,
  prossima partita, scheda capitolo con premio e striscia partite, una CTA fissa; prima pagina come foglio
  chiudibile; piano a tutta scheda solo quando va scelto; Carriera → Bacheca (obiettivi, trofei, stagioni).
  Motore: `GameState.goalRecords` facoltativo, scritto da `settleChapter`. Dettagli: `.claude/memory/app-design.md`, CHANGELOG.
- Altra sessione: 10 skill di sviluppo giochi (`e122874`) e `zzfx` (`6058a5a`), vedi `.claude/memory/tooling.md`.
- Verifica home: 70 test app, 419 motore, tsc, eslint, ng build ok; prova nel browser a 390 px; review Codex (P2 focus del foglio, corretto).

## Prossimo passo
1. Brainstorming su allenamenti, riposo e crescita del giocatore (richiesta dell'utente: "modo nuovo e geniale").
   Stato attuale già letto: 2 azioni per capitolo, crescita invisibile per seduta (`config/progression.json`).
   Domanda aperta all'utente: cosa vuol dire per lui "sentire" la crescita (momento, gioco di riferimento, mancanza).
2. Installazione su iPhone: rimandata dall'utente ("non installare al momento").

## Blocchi e domande aperte
- Risposta dell'utente sulla domanda del punto 1.
- Home: timbro "Raggiunto" prima della fine del capitolo; bilancio del foglio conta solo le settimane dello stop
  (dopo una vittoria mostra 0 V 0 N 0 P).
- Restano: "Simula" nella pagina partita, opzione "Partita predefinita" obsoleta, serate non raggiungibili dal piano.
- `pnpm lint` rosso per Prettier su 127 file preesistenti; versionamento delle `founder-*` da confermare.
- Regista da confermare: scarti su 5000 carriere dopo B3b, tempo al bordo basso (20,1 min).
- Non committare: modifiche iOS (.gitignore, .prettierignore, README, eslint, make-art.mjs, hunk iOS del CHANGELOG),
  `packages/app/ios/`, report e research_notes, `docs/superpowers/*ios*`, .DS_Store.

## File toccati
- `packages/app/src/app/pages/{week,career}.page.ts`, `packages/app/src/app/core/{chapter-view,game.service,unlocks}.ts`, `packages/app/test/`
- `packages/engine/src/{types.ts,season/goals.ts}`, `packages/engine/test/chapterGoals.test.ts`, `packages/content/data/i18n/it.ui.json`
- `.claude/skills/`, `.claude/memory/{app-design,tooling}.md`, `ASSETS.md`, `CHANGELOG.md`

## Skill consigliate
- `brainstorming` (allenamenti), poi `rpg` per i numeri di crescita; `frontend-design` per la UI.

## Firma
Claude Code, Opus 5.5, 2026-11-20 03:05. Deleghe Codex oggi: 15 (7 giorni: standard 59, leggero 19, forte 7).
