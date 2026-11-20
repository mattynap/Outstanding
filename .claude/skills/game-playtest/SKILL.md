---
name: game-playtest
description: Run browser-game playtests and frontend QA. Use when the user asks for smoke tests, screenshot-based verification, browser automation, HUD or overlay review, or structured issue-finding in a browser game.
---

# Game Playtest

## Overview

Use this skill to test browser games the way players experience them: through boot, input, scene transitions, HUD readability, and visual state changes. Prefer browser automation and screenshot review when the project supports it.

## Preferred Workflow

1. Boot the game and confirm the first actionable screen.
2. Exercise the main verbs.
3. Capture screenshots from representative states.
4. Check the UI layer independently from the render layer.
5. Report findings in severity order with reproduction steps.

## Tooling Guidance

- Prefer Playwright or equivalent browser automation already available in the repo.
- When the game is canvas or WebGL heavy, screenshots are mandatory because DOM assertions alone miss visual regressions.
- Use screenshots to judge playfield obstruction and HUD weight, not just correctness of text or layout.
- When deterministic automation is not practical, do a structured manual pass and capture evidence.
- For 3D rendering bugs or unexplained frame cost, use SpectorJS and browser performance tooling rather than guessing from code alone.

## Common Checks

### 2D checks

- sprite alignment and baseline consistency
- hit or hurt animation readability
- HUD overlap with the playfield
- command menu state changes
- tile or platform readability
- input-state feedback and turn-state clarity

### 3D checks

- first-load playability versus dashboard-like chrome
- persistent overlay weight versus playfield visibility
- camera control and camera reset behavior
- pointer-lock or drag-look transitions when menus and overlays open
- depth readability and silhouette clarity
- secondary panels collapsed or dismissible during normal play
- resize behavior
- WebGL context loss or renderer fallback behavior
- material or lighting regressions
- GLB or texture streaming stalls
- collision proxy or physics mismatch
- performance cliffs tied to post-processing or asset load

## Responsive and Browser Checks

- desktop and mobile viewport sanity
- safe-area and notch issues where relevant
- reduced-motion behavior for UI transitions
- keyboard, pointer, and pause-state handling
- React state and scene state synchronization when the project uses React Three Fiber

## Reporting Standard

Lead with findings. Keep each finding concrete:

- what the user sees
- how to reproduce it
- why it matters
- what likely subsystem owns it

## References

- Frontend review cues: `../game-ui-frontend/SKILL.md`
- Full checklist: `references/playtest-checklist.md`

## Nel progetto Outstanding (prevale sul resto)

- Stack: Angular + Ionic + Capacitor, Phaser 4.2.1 come renderer differito delle scene (`packages/app/src/app/scenes/`). Non c'è Vite.
- L'esito lo decide sempre il motore (`packages/engine`, puro e deterministico); la scena lo mostra. Niente regole di gioco nelle scene.
- Pixel art disegnata dal codice: usa `Pix`, `ensurePlayer`/`ensureBust` e `director`. Niente sprite, immagini o suoni esterni; i suoni si fanno con `zzfx` (MIT). Ogni dipendenza nuova va in `ASSETS.md`.
- Interfaccia: token di `docs/design-system.md` e regole della UI ibrida (memoria `ui-ibrido`); per ogni schermata o componente di interfaccia anche `frontend-design` (CLAUDE.md §10).
- API di Phaser: fai fede su `packages/app/node_modules/phaser/types/phaser.d.ts` (4.2.1), non su esempi di Phaser 3. Guida ufficiale in Markdown: `https://phaser.io/oss/docs/<pagina>.md`. Non proporre Phaser AE né servizi a crediti.
- Mobile first 360–430 px, una mano; prova finale su iPhone 15.
- Verifica attuale: screenshot con Chrome headless (rAF sostituito da setTimeout), poi prova su iPhone. Le scene vanno avviate con seme fisso, così lo screenshot è ripetibile.
- Il bilanciamento non si prova a mano: c'è il simulatore (`pnpm sim`). Le parti 3D del testo non si applicano.

Fonte: openai/plugins, plugins/game-studio v0.1.2 (licenza MIT dichiarata in plugin.json, testo in LICENSE), copiata il 2026-11-20. Modifiche: descrizione, link ai file locali, rimossi i rimandi alle skill 3D e sprite non installate, aggiunta questa sezione.
