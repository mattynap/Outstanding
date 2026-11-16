# Architettura

## Pacchetti e dipendenze

```
app ───────┐
           ├──► engine ──► config, content
simulator ─┘
```

- `engine`: TypeScript puro. Non importa mai `app`, Angular, Ionic, Phaser, Capacitor, API del
  browser o di Node. Le regole ESLint e il `tsconfig` (nessuna `lib` DOM, nessun tipo Node) lo
  impongono.
- `config`: file JSON di bilanciamento in `data/`, validati con Zod all'importazione.
- `content`: dati di contenuto (città, nomi, club, tratti, testi, eventi) in `data/`, validati con
  Zod; `pnpm content:check` esegue i controlli incrociati.
- `simulator`: CLI Node.js che usa il motore senza interfaccia. Gioca carriere complete con una
  strategia (`cautious`, `aggressive`, `random`) al posto del giocatore, in parallelo su più thread
  (`worker_threads`), e scrive un riepilogo delle metriche in `sim-output/` (non versionata).
  Le scelte delle strategie usano un `Rng` separato: i risultati dipendono solo dal seme.

- `app`: Angular 22 + Ionic 9 + Capacitor 8, componenti standalone con segnali. Struttura:
  `src/app/core` (servizi e funzioni pure: `GameService` unico punto di contatto con il motore,
  salvataggio automatico, traduzioni, viste di sola lettura in `views.ts`), `src/app/ui`
  (stemma, maglia, avatar, barre, navigazione), `src/app/pages` (una schermata per file, caricata
  su richiesta), `src/theme` (design system). L'app non contiene regole di gioco: chiama le
  funzioni del motore e mostra il risultato.
  Salvataggi (`src/app/core/saves`): `codec.ts` (formato del file: JSON del motore compresso),
  `slots.ts` (slot, indice, scrittura sicura, migrazione del vecchio salvataggio; archivio astratto
  `SaveBackend`, in memoria nei test), `capacitor-backend.ts` (Filesystem + Preferences).
  Servizi esterni (`src/app/core/services`): `services.ts` (interfacce e implementazioni finte,
  senza Angular) e `platform.service.ts` (le collega all'app; per gli SDK reali si cambiano solo le
  implementazioni create lì). Editor (`src/app/core/editor`): `edits-file.ts` (formato del file
  delle correzioni, Zod; vedi `docs/editor-format.md`) e `file-transfer.ts` (condivisione o
  scaricamento); le regole delle modifiche stanno nel motore (`engine/src/world/edits.ts`).
  I sorgenti di `engine`, `content` e `config` sono
  inclusi con i `paths` di `tsconfig.json`.

I pacchetti espongono direttamente i sorgenti TypeScript (`exports: ./src/index.ts`): niente passo
di build intermedio; `pnpm typecheck` controlla i tipi di tutti i pacchetti.

## Principi del motore

1. **Stato immutabile, funzioni pure:** `(stato, comando) => { stato, report }`.
2. **Determinismo:** solo la classe `Rng` con seme; il suo stato è salvato in `GameState.rngState`.
   Stesso seme + stesse scelte = stessa carriera.
3. **Nessun numero magico:** ogni costante di gioco sta in `packages/config/data/*.json`.
4. **Contenuti come dati:** in `packages/content/data/`.
5. **Salvataggi versionati:** `GameState.saveVersion` + migrazioni in `engine/src/save`.

Le funzioni pubbliche ricevono un `GameContext` opzionale (config + contenuti); se assente si usa
quello predefinito dei pacchetti `config` e `content`. Nei test si può iniettare un contesto
modificato.
