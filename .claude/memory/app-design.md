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

## Home in tre strati e Bacheca (2026-11-20)

- Richiesta dell'utente: home "troppo confusionaria" e una sezione premi. Scelta l'opzione A.
- Ordine: stato compatto e avvisi (solo se presenti) → prossima partita (senza pulsante) →
  scheda capitolo (obiettivo, premio, striscia partite, riga piano). Una sola CTA `sticky` in fondo.
- Prima pagina dello stop: foglio fisso sopra la home; chiuso quando `GameService.frontSeen` è lo
  stesso oggetto di `lastStop`. Sfondo `inert` e focus su "Continua" (review Codex). Il foglio
  lascia 64 px in basso per la barra delle schede, che resta sopra.
- Il piano a tutta scheda solo quando va scelto o lo si cambia ("Cambia").
- Premi automatici (niente "ritira"): valori in `calendar.chapterGoals`, mostrati sull'obiettivo.
- Bacheca = ex pagina Carriera (rotta invariata): obiettivi da `goalHistory` (motore:
  `GameState.goalRecords`, facoltativo), trofei, stagioni. Si sblocca al primo obiettivo chiuso.
- Aperto: il timbro "Raggiunto" compare prima della fine del capitolo; il bilancio del foglio conta
  solo le settimane scorse nello stop, non la partita appena giocata.

Collegato: [[design-preview]], [[progress]], [[regista-stagione]]
