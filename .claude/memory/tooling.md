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

Collegato: [[repo-setup]]
