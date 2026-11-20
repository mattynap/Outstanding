---
name: phaser-2d-game
description: Implement Phaser 4 scenes in Outstanding (key moments, pitch, press room, practice field). Use when writing or changing anything in packages/app/src/app/scenes, scene timing, camera, tweens or the bridge between engine reports and Phaser.
---

# Phaser 2D Game

## Overview

Use this skill for the main execution path in this plugin. Phaser is the default stack for 2D browser games here because it handles rendering, timing, sprites, cameras, and scene orchestration well without forcing gameplay rules into the framework.

Preferred stack:

- Phaser
- TypeScript
- Vite
- DOM-based HUD or menus layered over the game canvas

## Architecture

1. Keep gameplay state outside Phaser scenes.
   - Systems own rules, turn order, movement, combat, inventory, objectives, and progression.
   - Phaser scenes adapt system state into sprites, camera motion, animation playback, and effects.
2. Make scenes thin.
   - Boot and asset preload
   - Menu or shell scene
   - Gameplay scene
   - Optional overlay or debug scene
3. Keep renderer-facing objects disposable.
   - Sprite containers, emitters, tweens, and camera rigs are view state, not source of truth.
4. Favor stable asset manifest keys over direct file-path references throughout gameplay code.

## Implementation Guidance

- Use one integration boundary where the scene reads simulation state and emits input actions back.
- Prefer deterministic system updates over scene-local mutation.
- Treat HUD and menus as DOM when text, status density, or responsiveness matter.
- Keep animation state derived from gameplay state rather than ad hoc sprite flags.

## 2D Modes Covered Well

- Turn-based grids and tactics
- Top-down exploration
- Side-view action platformers
- Character-action combat with sprite animation
- Lightweight management or deck-driven battle scenes

## Camera and Presentation

- Choose the camera model early: locked, follow, room-based, or tactical-pan.
- Keep camera logic separate from game rules.
- Use restrained screen shake, hit-stop, and parallax. Effects should improve readability, not obscure it.

## UI Integration

- Use DOM overlays for HUD, command menus, settings, and narrative panels.
- Keep the canvas responsible for the world, combat readability, and motion.
- Avoid shoving dense text or complex settings UIs into Phaser unless the project explicitly needs an in-canvas presentation.

## Asset Organization

- `characters/`
- `environment/`
- `ui/`
- `fx/`
- `audio/`
- `data/`

Keep manifest keys human-readable and stable.

## Default Directory Shape

See `references/phaser-architecture.md` for a concrete module split (generic; in Outstanding the split is the one in the project section below).

## Anti-Patterns

- Game rules inside `update()` loops without a system boundary
- Scene-to-scene state passed through mutable global objects
- HUD text rendered in the game canvas just because it is convenient
- Asset paths embedded everywhere instead of a manifest layer
- Overusing generic React dashboard patterns for game UI

## References

- Frontend direction: `../game-ui-frontend/SKILL.md`
- Phaser structure: `references/phaser-architecture.md`

## Nel progetto Outstanding (prevale sul resto)

- Stack: Angular + Ionic + Capacitor, Phaser 4.2.1 come renderer differito delle scene (`packages/app/src/app/scenes/`). Non c'è Vite.
- L'esito lo decide sempre il motore (`packages/engine`, puro e deterministico); la scena lo mostra. Niente regole di gioco nelle scene.
- Pixel art disegnata dal codice: usa `Pix`, `ensurePlayer`/`ensureBust` e `director`. Niente sprite, immagini o suoni esterni; i suoni si fanno con `zzfx` (MIT). Ogni dipendenza nuova va in `ASSETS.md`.
- Interfaccia: token di `docs/design-system.md` e regole della UI ibrida (memoria `ui-ibrido`); per ogni schermata o componente di interfaccia anche `frontend-design` (CLAUDE.md §10).
- API di Phaser: fai fede su `packages/app/node_modules/phaser/types/phaser.d.ts` (4.2.1), non su esempi di Phaser 3. Guida ufficiale in Markdown: `https://phaser.io/oss/docs/<pagina>.md`. Non proporre Phaser AE né servizi a crediti.
- Mobile first 360–430 px, una mano; prova finale su iPhone 15.
- La divisione in moduli del file `references/phaser-architecture.md` è generica: qui simulazione = `packages/engine`, contenuti = `packages/content`, parametri = `packages/config`, render = `packages/app/src/app/scenes`.

Fonte: openai/plugins, plugins/game-studio v0.1.2 (licenza MIT dichiarata in plugin.json, testo in LICENSE), copiata il 2026-11-20. Modifiche: descrizione, link ai file locali, rimossi i rimandi alle skill 3D e sprite non installate, aggiunta questa sezione.
