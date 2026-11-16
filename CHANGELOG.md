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

### M1 – Nucleo motore

- Tipi del modello dati (`Player`, `GameState`, `Club`, `League`, `Fixture`, `World`, ...).
- Generatore `Rng` con seme (xoshiro128\*\* + splitmix32): interi, float, normale senza funzioni
  trascendenti, scelta pesata, mescolamento, Poisson. Stato salvato in `GameState.rngState`.
- `newCareer(options, seed)`: creazione del giocatore a 16 anni con abilità per ruolo, potenziale
  nascosto, tratti validati.
- Calcolo dell'OVR pesato per ruolo (`config/ratings.json`).
- Pacchetto `config`: `ratings.json`, `player.json`, `calendar.json` validati con Zod.
- Pacchetto `content`: nomi, tratti, testi italiani, validatore incrociato (`pnpm content:check`).
- Salvataggi: `serialize` / `deserialize` con `saveVersion` e catena di migrazioni.
- Test di determinismo, di ripresa da stato salvato e sequenza di riferimento congelata.

### M2 – Mondo

- Piramide fittizia a 6 livelli (`config/world.json`): Serie Oro, Serie Argento, Serie Bronzo
  (3 gironi), Lega Interzonale (3 gironi), Regionale Maggiore e Regionale Minore (dilettanti,
  3 gironi ciascuno per area Nord/Centro/Sud). 250 club in totale.
- Validazione del bilanciamento promozioni/retrocessioni tra livelli adiacenti.
- 122 città italiane reali (`content/data/cities.json`) con regione, area, dimensione ed epiteti
  inventati; nomi dei club = prefisso + epiteto (es. "Atletico Lagunare"), unici.
- Rose compatte generate attorno alla forza del club; rating del club = media dei migliori undici.
- Dati per stemmi (forma, colori, simbolo, iniziali) e maglie (colori, motivo) deterministici dal
  seme del club.
- Allenatore per ogni club e procuratori; competizioni definite (coppa nazionale, due coppe
  europee) ma non ancora giocate.
- `newCareer` accetta `startLevel` e firma il primo contratto dilettantistico con un club dell'area
  della città natale (preferibilmente della città stessa).
