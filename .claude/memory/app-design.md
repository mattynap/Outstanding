---
name: app-design
description: Struttura dell'app Angular/Ionic (M9), scelte tecniche e insidie già incontrate
metadata:
  type: project
---

- Angular 22.2 (richiede TypeScript `>=6.0 <6.1`, compatibile con il TS fissato), Ionic 9,
  Capacitor 8, ionicons 8. **Ionic 9 non ha più `@ionic/angular/standalone`**: i componenti
  standalone si importano da `@ionic/angular`.
- Zone.js attivo (`provideZoneChangeDetection`) per sicurezza con Ionic; stato in segnali.
- I pacchetti del monorepo entrano con i `paths` di `packages/app/tsconfig.json`; `rootDir: ../..`
  in `tsconfig.app.json` serve al `pnpm typecheck`. `zod` deve stare anche tra le dipendenze
  dell'app (il dev server di Vite risolve gli import dalla cartella dell'app).
- Nel `provideAppInitializer` chiamare `inject()` **prima** di qualsiasi `await` (errore NG0203).
- Navigazione in basso fatta a mano (`app-tab-bar`) dentro ogni pagina, non `ion-tabs`.
- `Intl` italiano non separa le migliaia sotto 10.000 ("€ 1200"): è corretto, non un bug.
- Le icone si registrano con `addIcons` nel componente (nessun asset SVG copiato).
- Testi solo in `content/data/i18n/it.ui.json` (prefisso `ui.`); `packages/app/test/texts.test.ts`
  fallisce se una chiave usata nel codice non esiste.
- Prova nel browser: script Playwright in Python (installato sulla macchina) contro `ng serve`.

## Home a capitoli (2026-11-20)

- La home resta sulla rotta `/settimana` ma segue il ciclo a capitoli: `advanceToStop`,
  `setChapterPlan`, partite scelte in `chapter.picks`. Logica pura in `core/chapter-view.ts`
  (`nextStep`, `needsPlan`, `goalView`, `chapterPicks`), testata in `test/chapter-view.test.ts`.
- Il piano si sceglie agli stop; è obbligatorio a inizio stagione e a ogni capitolo nuovo.
  L'ultimo stop (`GameService.lastStop`) vive solo in memoria: dopo un riavvio l'apertura del
  capitolo si riconosce dallo stato (prima settimana del capitolo non pianificata).
- Le serate (`kind: party`) restano fuori dal piano: `repeatPlan` del motore le scarta.
- Si gioca una partita scelta solo a settimana preparata (`plannedWeek` ed `eventsWeek` uguali a
  `week`): allo stop `chapterEnd` la settimana è intatta e si va prima "avanti" con il piano nuovo.
- La partita parte nella modalità del regista (`pick.mode`). Restano aperti: l'opzione
  "Partita predefinita" nelle impostazioni e il pulsante "Simula" della pagina partita.

Collegato: [[design-preview]], [[progress]], [[regista-stagione]]
