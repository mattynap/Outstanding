# Handoff

## Stato
Piano del regista di partita e stagione scritto, rivisto (ricerca + review Codex, 10 problemi corretti)
e **approvato dall'utente il 2026-11-18**. Nessuna modifica al codice.
Piano: `docs/superpowers/plans/2026-11-18-regista-partita-stagione.md` (task A0–A10, A7b, B1–B4).
Spec: `docs/superpowers/specs/2026-11-18-regista-partita-stagione-design.md` (§8.4 = meccaniche aggiunte).
Ricerca: `reports/Meccaniche regista partita e stagione.md`.
Esecuzione scelta: subagent-driven, review dopo ogni task.

## Prossimo passo
Eseguire il piano con `subagent-driven-development`, partendo dal Task A0 (baseline del simulatore).
Checkpoint con l'utente alla fine della Parte A (numeri del simulatore), prima della Parte B.
Prompt di partenza: è nell'ultima risposta della sessione del 2026-11-18 (vedi anche TASKS).

## Blocchi e domande aperte
- Push: 7 commit locali su `ciro-dev` (da 91ca0ff a 8b08822) non pushati. Chiedere prima di pushare.
- File non di questo lavoro, da non committare senza richiesta: `packages/app/ios/`, modifiche iOS
  (.gitignore, README, package.json, pnpm-lock, make-art.mjs, eslint, CHANGELOG), report e research_notes precedenti, .DS_Store.
- Restano aperte: offerta (`founder/offer.md`), prova con i tester, feedback iPhone dell'interfaccia ibrida.

## File toccati
- `docs/superpowers/specs/2026-11-18-regista-partita-stagione-design.md`
- `docs/superpowers/plans/2026-11-18-regista-partita-stagione.md`
- `reports/Meccaniche regista partita e stagione.md`
- `~/.ai/cache/ricerche/regista-partita-stagione-meccaniche-2026-11-18.md`

## Skill consigliate
- subagent-driven-development, test-driven-development, verification-before-completion.

## Firma
Claude Code, Opus 5.5, 2026-11-18. Deleghe Codex oggi: 14 (leggero 10, standard 3, forte 1).
