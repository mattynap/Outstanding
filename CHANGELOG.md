# Changelog

Tutte le modifiche rilevanti del progetto. Formato ispirato a
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [Non rilasciato]

### M0 – Setup

- Monorepo pnpm con i pacchetti `engine`, `content`, `config`, `simulator` (e segnaposto `app`).
- TypeScript strict (con `noUncheckedIndexedAccess`), ESLint (flat config) e Prettier.
- Regole ESLint dedicate al motore: vietati `Math.random`, `Date.now`, `new Date`, API del
  browser e import di Angular, Ionic, Capacitor, Phaser.
- Vitest configurato alla radice; script `test`, `typecheck`, `lint`, `format`, `content:check`, `sim`.
- Documentazione iniziale: README, architettura, sintesi di design, guida di stile, design system,
  registro degli asset.
