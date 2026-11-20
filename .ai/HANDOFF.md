# Handoff

## Stato
Sessione su strumenti e skill per lo sviluppo del gioco (dalla ricerca "Skill e risorse per creare giochi").
- Installate 10 skill in `.claude/skills/` (Game Studio MIT; awesome-gamedev Apache-2.0), ognuna con la
  sezione "Nel progetto Outstanding". Commit `e122874`. Elenco ed esclusioni in `.claude/memory/tooling.md`.
- `zzfx@1.4.0` nell'app, registrato in `ASSETS.md`, non ancora usato. Commit `6058a5a`, separato dagli hunk iOS.
- Report unico (non versionato): `reports/Skill e tecnologie per Outstanding.md`; il doppione è stato rimosso.
- Prima di questi, due commit di un'altra sessione sulla home (`d236087`, `5793c2d`) senza handoff proprio.
- Verifica: typecheck ok, 558 test passati, 1 saltato. `pnpm lint` fallisce per Prettier su 127 file
  preesistenti (`.superpowers/`, `docs/superpowers/`, `research_notes/`, `reports/`, `.ai/`).

## Prossimo passo
1. Push di `ciro-dev`: l'utente l'ha chiesto, ma il hook lo blocca; va lanciato a mano con `!`.
2. Riprendere da `.ai/TASKS.md` (Prossimi). Le nuove voci dal report sono in coda.

## Blocchi e domande aperte
- Push in attesa del lancio manuale dell'utente.
- Skill `founder-*` non versionate (il `.gitignore` in sospeso tiene `founder/` solo locale): confermare.
- `pnpm lint` rosso su file non di questa sessione: decidere se formattarli o escluderli da Prettier.
- Ancora da confermare (regista): scarti su 5000 carriere dopo B3b (assist −10,1%, trofei −11,1% vs A0), tempo al bordo basso (20,1 min).
- `docs/design/README.md` è indietro su CLAUDE.md (carriera 2–4 ore e partita a blocchi).
- Non committare: modifiche iOS (package.json, pnpm-lock, .gitignore, .prettierignore, README, eslint,
  make-art.mjs, CHANGELOG), `packages/app/ios/`, report e research_notes, .DS_Store.

## File toccati
- `.claude/skills/{phaser-2d-game,game-ui-frontend,game-playtest,phaser-core,game-feel,rpg,roguelike,game-ui-ux,audio-design,game-docs}/`
- `.claude/memory/tooling.md`, `ASSETS.md`, `packages/app/package.json`, `pnpm-lock.yaml`
- `reports/Skill e tecnologie per Outstanding.md` (non versionato)

## Skill consigliate
- Scene: `phaser-2d-game`, `phaser-core`, `game-feel`; UI: `game-ui-frontend`, `game-ui-ux`, `frontend-design`.
- Bilanciamento: `rpg`; QA: `game-playtest`; suoni: `audio-design`; sintesi di design: `game-docs`.

## Firma
Claude Code, Opus 5.5, 2026-11-20. Deleghe Codex oggi: 15 (7 giorni: standard 59, leggero 19, forte 7).
