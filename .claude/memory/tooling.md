---
name: tooling
description: Scelte di tooling del monorepo (versioni, perché TypeScript 6, pacchetti senza build)
metadata:
  type: project
---

- pnpm 10 installato globalmente con `npm i -g pnpm` (corepack non attivo sulla macchina). esbuild è
  in `onlyBuiltDependencies` di `pnpm-workspace.yaml`, serve a tsx/vitest.
- TypeScript fissato a `~6.0` (2026-11-16): TypeScript 7 è uscito ma typescript-eslint 8.72 supporta
  solo `<6.1`. **Why:** il lint si rompe con TS 7. **How to apply:** aggiornare TS solo quando
  typescript-eslint (e Angular, in M9) lo supportano.
- I pacchetti esportano `./src/index.ts` direttamente; nessuna build, solo `pnpm typecheck`.
  JSON importati con `resolveJsonModule` (moduleResolution Bundler).
- Dipendenze scelte: zod (validazione, MIT), vitest (test, MIT), tsx (eseguire TS da CLI, MIT),
  ESLint + typescript-eslint + Prettier (MIT).
- fflate (MIT, puro JS, veloce) per comprimere i salvataggi nell'app; @capacitor/filesystem per i
  file degli slot. La compressione sta nell'app, non nel motore (che resta senza dipendenze).
- Il motore ha `lib: ES2022` e `types: []`: niente DOM né Node, imposto anche da regole ESLint.
- zzfx 1.4.0 (MIT) nel pacchetto app (2026-11-20) per gli effetti sonori generati dal codice. **Why:**
  coerente con "niente asset esterni" nelle scene, pesa pochi KB. **How to apply:** il pacchetto non ha
  tipi TypeScript: al primo uso serve una dichiarazione `.d.ts` locale; l'audio di Phaser resta spento
  (`noAudio`), ZzFX usa un suo AudioContext. Su iOS l'audio parte solo dopo un tocco dell'utente.
- Skill di sviluppo giochi in `.claude/skills/` (2026-11-20): `phaser-2d-game`, `game-ui-frontend`,
  `game-playtest` (OpenAI Game Studio, MIT) e `phaser-core`, `game-feel`, `game-ui-ux`, `audio-design`,
  `rpg`, `roguelike`, `game-docs` (awesome-gamedev-agent-skills, Apache-2.0), ognuna con una sezione "Nel progetto Outstanding". **Why:** `phaser.io/llms.txt` non si
  usa: è un indice commerciale di Phaser AE; per le API fanno fede i tipi in
  `packages/app/node_modules/phaser/types/phaser.d.ts`. `game-docs/scripts/check_docs.py` usa solo la
  libreria standard e non scrive file; si lancia con `python3 -I`.

Collegato: [[repo-setup]]
