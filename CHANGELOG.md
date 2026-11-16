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

### M3 – Calendario e stagione

- Calendario andata/ritorno per ogni girone (round robin con alternanza casa/trasferta), giornate
  distribuite sulle settimane di campionato (`config/calendar.json`).
- Classifiche con punti, differenza reti e gol fatti (`config/world.json` → `points`).
- Simulazione rapida delle partite degli altri club basata sul rating (`config/match.json` →
  `quickSim`), `advanceWeek` settimana per settimana, finestre di mercato estiva e invernale.
- `endSeason`: classifiche finali, promozioni e retrocessioni, riassegnazione dei gironi per area,
  evoluzione delle rose (età e ricambio), storico della stagione del giocatore, nuovo calendario.
  Rinnovo automatico temporaneo del contratto in attesa di M7.
- Verificata la stabilità dei rating medi per livello su 15 stagioni (nessuna deriva).

### M4 – Partita

- Convocazione (titolare / panchina / fuori) da OVR, forma, morale, fiducia dell'allenatore e
  concorrenza nel ruolo; infortunati sempre fuori. Cambi con minuti di ingresso e uscita.
- Simulazione a 6 blocchi da 15 minuti basata sul rating dei club, con l'influenza del giocatore
  quando è in campo.
- 17 tipi di momento chiave per ruolo (portiere, difensore, centrocampista, attaccante), da 2 a 4
  opzioni ciascuno. Probabilità di successo logistica (abilità pesate − forza avversaria −
  difficoltà) con modificatori di forma, morale, energia e tratti, limitata tra 5% e 95%.
- Partita come macchina a stati salvabile (`GameState.currentMatch`): `beginMatch`,
  `getPendingMoment`, `decideMoment` e `playMatch(state, decide)` per UI e simulatore.
- Pagella da 4 a 10 a passi di 0,5 ("senza voto" sotto i minuti minimi), riga di commento con
  varianti, cronaca con marcatori e assist, statistiche stagionali (presenze, minuti, gol, assist,
  porte inviolate, media voto).
- Tutti i parametri in `config/match.json` validati con Zod; testi italiani di momenti e commenti.

### M5 – Eventi

- Schema Zod degli eventi (`content/src/events.ts`): condizioni (età, statistiche, finestra di
  mercato, flag, ruoli, livello, tratti, infortunio, rapporto con il mister, settimana della
  stagione), effetti `stat`, `money`, `flag`, `relationship`, `schedule`, `startTransfer`,
  `injury`, `trait` e `chance` (esito incerto, annidabile).
- 22 eventi in 6 categorie (spogliatoio, allenamento, media, vita, famiglia, mercato), con varianti
  di testo e tre catene; testi in `i18n/it.events.json`.
- Validatore ampliato (`pnpm content:check`): chiavi di testo, segnaposto ammessi, catene verso
  eventi esistenti, eventi in catena mai attivati, tratti citati, id e chiavi duplicati.
- Motore: `drawWeekEvents` (eventi in catena in scadenza più estrazione pesata, cooldown, eventi
  unici, massimo per settimana e per categoria da `config/events.json`), `getPendingEvents`,
  `resolveEvent` con resoconto delle modifiche. Settimana e partita restano bloccate finché gli
  eventi non hanno risposta.
- Gli infortuni calano di una settimana a ogni `advanceWeek`.
- Le richieste di trasferimento nate dagli eventi vengono salvate in `GameState.transferRequests`
  per il mercato (M7).
- Guida di stile dei contenuti completa del formato degli eventi.
