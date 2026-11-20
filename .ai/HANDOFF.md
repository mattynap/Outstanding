# Handoff

## Stato
Piano del regista di partita e stagione eseguito tutto (A0–A10, A7b, B1–B4, più B3b), subagent-driven,
con review per task (Sonnet + Codex) e revisione finale del branch (Opus + Codex) chiusa senza P1/P2 aperti.
Suite: 552 test passati, 1 saltato; content:check ok. Report: `reports/regista/confronto-A10.md`, `reports/regista/stagione-B3.md`.
Numeri finali (ciclo a capitoli, prudente, 1000 carriere): gol 54,2, assist 57,8, trofei 0,83, massima serie 56,8%,
leggende 2,5%; 20,1 min a stagione, 7,0 h a carriera. Criterio fra strategie (ciclo settimane) rispettato.

## Prossimo passo
Il regista è chiuso; la prossima sessione riparte dagli altri lavori in `.ai/TASKS.md` (Prossimi, in ordine).
1. Chiedere all'utente il push di `ciro-dev` (82 commit locali).
2. App su `advanceToStop` con annuncio ed esito dell'obiettivo di capitolo, poi prova su iPhone.
3. Brainstorming settimana e allenamento leggibili (approccio B punto 3), poi collegamenti fra sistemi (punto 4).
4. Decisioni sull'offerta in `founder/offer.md` e prova con 10–15 tester (`founder/launch.md`).

## Blocchi e domande aperte
- Push non fatto: serve il via dell'utente.
- Da confermare dall'utente: scarti marginali su 5000 carriere dopo B3b (assist −10,1%, trofei −11,1% vs A0), poi rientrati a 1000 dopo B4; tempo al bordo basso (20,1 min).
- Parcheggiati: tablePosition valutato sul nuovo club dopo un trasferimento a metà capitolo; test della collisione offerta+notizia; obiettivi di classifica raggiunti solo nel 27% dei casi.
- Non committare: `packages/app/ios/`, modifiche iOS (.gitignore, .prettierignore, README, package.json, pnpm-lock, make-art.mjs, eslint, hunk iOS del CHANGELOG), report e research_notes precedenti, .DS_Store.

## File toccati
- `packages/engine/src/match/` (director, match, moments), `packages/engine/src/season/` (director, goals, fastForward, endSeason), `packages/engine/src/save/serialize.ts`
- `packages/config/data/` (match, moments, calendar, career), `packages/config/src/schemas.ts`
- `packages/content/data/chapter-goals.json`, `packages/content/data/i18n/it*.json`, `packages/content/src/check.ts`
- `packages/simulator/src/`, `reports/regista/`, `CHANGELOG.md`, `.claude/memory/regista-*.md`

## Skill consigliate
- frontend-design (app), verification-before-completion.

## Firma
Claude Code, Opus 5.5, 2026-11-20. Deleghe Codex oggi: 0 (sessione solo di chiusura; 7 giorni: standard 51, leggero 12, forte 7).
