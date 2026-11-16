# Outstanding — gioco di carriera calcistica

Gioco mobile (Android, poi iOS) che simula la carriera di un calciatore italiano in campo e fuori,
dai 16 anni nei dilettanti fino al ritiro. Mondo interamente fittizio: nessun nome reale di club,
giocatori, campionati o sponsor.

## Requisiti

- Node.js 22 o superiore
- pnpm 10 (`npm i -g pnpm` oppure `corepack enable`)

## Comandi

```bash
pnpm install
pnpm test               # tutti i test (Vitest)
pnpm typecheck          # controllo dei tipi di tutti i pacchetti
pnpm lint               # ESLint + Prettier
pnpm format             # formatta il codice con Prettier
pnpm content:check      # valida contenuti e testi
pnpm sim --careers 1000 --strategy cautious --seed 42   # oppure --strategy all, --workers N, --details
```

## Struttura

| Pacchetto            | Contenuto                                                      |
| -------------------- | -------------------------------------------------------------- |
| `packages/engine`    | Motore di gioco in TypeScript puro e deterministico            |
| `packages/content`   | Contenuti di gioco (nomi, città, club, eventi, testi) + schema |
| `packages/config`    | Parametri di bilanciamento (JSON) + schema Zod                 |
| `packages/simulator` | CLI che gioca carriere automatiche per il bilanciamento        |
| `packages/app`       | App Angular + Ionic + Capacitor (dalla milestone M9)           |

Documentazione: [`docs/architecture.md`](docs/architecture.md), [`docs/design/`](docs/design/),
[`docs/content-style-guide.md`](docs/content-style-guide.md),
[`docs/design-system.md`](docs/design-system.md). Storico delle modifiche in
[`CHANGELOG.md`](CHANGELOG.md), licenze degli asset in [`ASSETS.md`](ASSETS.md).
