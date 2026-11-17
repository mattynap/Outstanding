# Handoff

## Stato
Interfaccia ibrida giornale + pixel: ondate 1 e 2 del piano `docs/superpowers/plans/2026-11-17-ui-ux-ibrido.md` fatte.
Review finale su tutto il ramo fatta; i due problemi importanti sono corretti (`df89d57`).
302 test, typecheck, content:check e build iOS verdi. App aggiornata installata e aperta su iPhone 15.
Commit `aa00295`…`df89d57` su `ciro-dev`; nessun push.

## Prossimo passo
- Raccogliere il feedback dell'utente sull'iPhone. Da provare: settimana con Completa/Simulata e Gioca, pagella con le voci, notizie come prima pagina, guida corta in una carriera nuova.
- Correggere ciò che emerge; poi, solo con l'approvazione dell'utente, ondata 3 del piano (le altre schermate).
- Valutare con l'utente i minori rimandati: elenco in `.superpowers/sdd/2026-11-17-ui-ux-ibrido/progress.md` (righe `Final: minor (deferred)`).

## Blocchi e domande aperte
- Ondata 3 ferma finché l'utente non approva la prova su iPhone.
- Voto decimale ("6,5") nel badge da 72 px mai visto a schermo.
- Tasto indietro Android non provato su dispositivo.
- Restano aperte le decisioni della sessione precedente: direzione pixel completa, durata carriera, ordine M18–M23/M12.
- Lasciati fuori dai commit di proposito: `packages/app/ios/`, la sezione iOS di `CHANGELOG.md`, `README.md`, `.prettierignore`, `eslint.config.js`, `make-art.mjs`, `reports/`, `research_notes/`.

## File toccati
- `packages/engine/src/match/` (voci del voto, conseguenze dei momenti), `packages/engine/test/`.
- `packages/app/src/app/pages/` (week, match, event, settings), `core/` (match-mode, tutorial, text, settings.service), `theme/components.css`, `theme/tokens.css`.
- `packages/app/test/`, `packages/content/data/i18n/it.ui.json`.
- `docs/design-system.md`, `CHANGELOG.md`, `.claude/memory/ui-ibrido.md`, `.claude/memory/lingua-risposte.md`.

## Skill consigliate
- executing-plans per l'ondata 3 (il registro è in `.superpowers/sdd/2026-11-17-ui-ux-ibrido/`), frontend-design per ogni schermata, test-driven-development.

## Firma
Claude Code, Opus 5.5, 2026-11-17
