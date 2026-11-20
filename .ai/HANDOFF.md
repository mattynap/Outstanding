# Handoff

## Stato
Settimana leggibile progettata e pianificata (punto 3 dell'approccio B). Solo documenti, nessun codice toccato.
- Spec approvata: `docs/superpowers/specs/2026-11-20-settimana-leggibile-design.md` (`d8a5067`).
  Due binari: carico (Scarico/Equilibrio/Spinta, tetto di freschezza 100/90/70) + un'azione fuori dal campo
  (Famiglia, Svago, Sponsor, Serata) come modificatori dichiarati; freschezza unica al posto di energia e rischio,
  anche nella convocazione; anteprima esatta prima, registro "Dal piano" dopo. Salvataggi v4.
- Falle misurate con sonda (100 carriere per piano fisso) e audit Codex: tabella e F1–F11 nella spec §2.
- Builder check, architetto e Codex forte fatti; correzioni e scelte mie segnate nella spec.
- Piano: `docs/superpowers/plans/2026-11-20-settimana-leggibile.md` (`ec31879`), Task 0–15.

## Prossimo passo
1. Eseguire il piano con `subagent-driven-development` (scelta dell'utente): un subagente per task e revisore
   dopo ciascuno. Partire dal Task 0 (baseline 5000 carriere, seed 42, cautious e contextual, codice di oggi).
2. Task 7 (cambio API e v4) è il punto critico: tutto in un commit, build app compresa.

## Blocchi e domande aperte
- Ruolo meccanico della felicità (rimandato a M16); disciplina visibile fra gli obiettivi di capitolo? (spec §7).
- Restano dalla sessione precedente: timbro "Raggiunto", bilancio del foglio, "Simula", "Partita predefinita".
- `pnpm lint` rosso per Prettier su 127 file preesistenti; versionamento delle `founder-*` da confermare.
- Non committare: modifiche iOS (.gitignore, .prettierignore, README, eslint, make-art.mjs, package.json app,
  pnpm-lock, hunk iOS del CHANGELOG), `packages/app/ios/`, report e research_notes, `docs/superpowers/*ios*`, .DS_Store.
- Push di `d8a5067` ed `ec31879` non fatto.

## File toccati
- `docs/superpowers/specs/2026-11-20-settimana-leggibile-design.md`
- `docs/superpowers/plans/2026-11-20-settimana-leggibile.md`

## Skill consigliate
- `subagent-driven-development`; `rpg` per la taratura (Task 12); `frontend-design`, `game-ui-ux`, `game-feel` per i Task 13–14.

## Firma
Claude Code, Opus 5.5, 2026-11-20 05:28. Deleghe Codex oggi: 17 (7 giorni: standard 60, leggero 19, forte 8);
in questa sessione 2 (standard audit falle, forte parere sulla spec).
