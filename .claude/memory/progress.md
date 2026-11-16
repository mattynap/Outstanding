---
name: progress
description: Stato di avanzamento delle milestone e punto esatto da cui riprendere
metadata:
  node_type: memory
  type: project
  originSessionId: ba3e7028-a690-4902-a1e6-0b641b622f63
  modified: 2026-11-16T20:38:42.992Z
---

Obiettivo concordato (2026-11-16): sviluppare M0→M4 in autonomia, commit + CHANGELOG + memoria a fine
di ogni milestone, poi **fermarsi dopo M4** per la revisione dell'utente.

## Stato al 2026-11-16

- M0–M11b (con M7b) completate e pushate sul branch `dev`.
- M4: modulo `engine/src/match/`, parametri in `config/match.json`. Bilanciamento indicativo
  (prima stagione, scelte casuali): ATT ~15 gol in 30 partite, 2,8–3 gol a partita. Da rivedere
  con il simulatore in M8. La partita non tocca ancora forma/energia/morale/fiducia (M6).
- M5: eventi in `content/data/events/<categoria>/*.json` registrati in `content/src/eventFiles.ts`,
  testi in `i18n/it.events.json`, motore in `engine/src/events/`, config in `config/events.json`.
  Flusso settimana: `drawWeekEvents` → `resolveEvent` per ciascuno → (`playMatch`) → `advanceWeek`.
- Rimandati a milestone successive: effetto `relationship` con `target: agent` non fa nulla finché
  non c'è il procuratore (M7); `transferRequests` saranno consumate dal mercato (M7); le regole
  complete degli infortuni (rischio, ricadute) arrivano in M6.
- M6: `engine/src/player/progression.ts` (crescita, declino, infortuni), `player/condition.ts`
  (dopo-partita, recupero settimanale), `season/plan.ts` (`planWeek`, `skipToNextMatch`), config in
  `config/progression.json`. Flusso settimana: `planWeek` → `drawWeekEvents`/`resolveEvent` →
  `playMatch` → `advanceWeek` (planWeek facoltativo: senza piano non si cresce).
- Taratura M6 (8 carriere, 20 stagioni, piano allenamento+riposo): OVR medio 45 a 17 anni, 72 a 25,
  picco 74 fino a 31, 68 a 36; ~8 infortuni a carriera. Con allenamento intenso+normale si arriva al
  potenziale ~2 anni prima ma ~40 infortuni a carriera: compromesso voluto, da rivedere in M8.
- Ritiro (decisione utente 2026-11-16, opzione 2): **decide il mercato**. Ritiro automatico quando
  nessun club offre un contratto (dai 33 anni, a fine finestra estiva senza squadra) o a 40 anni;
  il giocatore può ritirarsi prima di sua scelta dai 33. Implementato in M7.
- M7: `engine/src/market/offers.ts` (offerte, trattative, rinnovi, prestiti, sponsor, ritiro per
  mancanza di offerte: `refreshMarket` chiamato da `advanceWeek`), `market/life.ts` (finanze,
  tenore di vita, procuratore, sponsor, `retire`, `seasonMarketTransition` chiamato da `endSeason`).
  Config in `config/economy.json`, marchi in `content/data/sponsors.json`.
- Verifica M7 (12 carriere, strategia "firma l'offerta del livello più alto"): 10/12 in massima
  serie, esordio 22–26 anni, ritiro 33–39. Da tarare in M8: i potenziali altissimi (90+) si fermano
  a ~80 (la crescita satura con `potentialGapScale`); i guadagni in carriera (3–36 milioni) dipendono
  da stipendi di massima serie fino a 60.000/settimana.
- M7b (coppe, 2026-11-16): modulo `engine/src/cups/cups.ts`, club stranieri in
  `engine/src/world/foreign.ts`, config `config/cups.json`, contenuti `content/data/foreign.json`.
  Decisioni in [[cups-design]]. Flusso settimana invariato, ma possono esserci **due partite**:
  `while (playerFixture(s)) playMatch(...)` prima di `advanceWeek`.
- M8 (simulatore, 2026-11-16): vedi [[simulator-design]]. Prima misurazione, 5000 carriere, seme 42
  (prudente / aggressiva / casuale): massima serie 70% / 70% / 3,5%; leggende 9,8% / 0% / 0%;
  ritiro 38,6 / 39,6 / 38 anni; tempo stimato ~10 h / ~10 h / ~10 h.
- Taratura fatta il 2026-11-16 (decisioni in [[simulator-design]]). Risultati prudente: massima
  serie 61%, esordio 25,5, leggende 2,7% (2,3–3,6% per ruolo), ritiro 37, media voto 6,23.
- Aperto: **tempo di gioco** ~3 h (tutte simulate) / ~6 h (giocate le importanti) / ~7 h (tutte
  giocate) contro l'obiettivo 2–4 h: da ridiscutere con l'utente (es. meno momenti nelle partite
  giocate, piano settimanale ripetuto in automatico). Strategia aggressiva peggiore (voto 5,75):
  il rischio paga solo contro avversari più deboli, coerente col design. I centrocampisti prudenti
  non segnano mai (tutte le opzioni da gol sono rischiose). Trofei europei rari (0,01 a carriera).
- M9 (app, 2026-11-16): vedi [[app-design]]. Verificata nel browser con Playwright (giro completo
  creazione → settimana → notizie → partita → pagella → tutte le schede, tema chiaro), nessun
  errore in console. Avvio: `pnpm --filter @outstanding/app start` (porta 4200).
- M10 (salvataggi, 2026-11-16): 3 slot (scelta mia, costante `SLOT_COUNT`), file compressi con
  fflate (~215 KB), coda di scrittura, recupero del file temporaneo, migrazione del salvataggio di
  M9. Provato nel browser (ricarica, due carriere, migrazione). `saveVersion` resta 1 fino alla
  pubblicazione (vedi [[engine-design]]).
- M11 (servizi, 2026-11-16). Decisioni utente: pubblicità a premio **nessuna per ora** (solo
  interfaccia); analytics **solo con consenso**. Acquisti: nessuna preferenza → ho scelto
  "Versione completa" (un prodotto `full_version`, entitlement `full`, toglie la pubblicità e in
  futuro sblocca gli eventi oltre i 100 della prova). **Da fare quando ci saranno 100 eventi:**
  marcare gli eventi della versione completa e filtrarli senza l'entitlement.
- M11b (editor, 2026-11-16): vedi [[editor-design]]. Provato nel browser con Playwright (club,
  persone, competizioni, esporta → annulla tutto → importa, nomi visibili in classifica).
- M13 (basi, 2026-11-16): difficoltà (decisione utente: tocca anche le partite), settimana guidata
  (decisione utente: vera prima settimana con note), modalità di gioco solo testuale. Numeri in
  CHANGELOG. Provato nel browser con Playwright (guida completa, impostazioni), nessun errore.
- M14 (personaggio, 2026-11-16): avatar stile "figurina" (scelta utente tra 3 proposte, anteprima
  https://claude.ai/artifact/4DQJgFiTwGngiFBVhLBAUi), tatuaggi base + sblocchi in carriera (scelta
  utente). Provato nel browser con Playwright.
- M15 (finanze, 2026-11-16): decisioni in [[user-ideas-roadmap]]; provato nel browser
  (deposito, acquisto cripto, grafico, mutuo rifiutato, prestito). Simulatore invariato.
- M16 (vita privata, 2026-11-16): decisioni in [[user-ideas-roadmap]]; provato nel browser
  (incontro, proposta, crisi, divorzio con alert, notizia "Cuori", impostazioni). Lo stato di prova
  si inietta con `ng.getComponent(document.querySelector('app-private')).game.commit(...)` (solo in
  sviluppo). Simulatore quasi invariato (61,2% / 3,0%).
- M17 (media, 2026-11-16): decisioni in [[user-ideas-roadmap]]; provato nel browser (post,
  presentazione in conferenza, partita giocata con intervista, feed). Aggiunti i plurali nei testi
  (`{n|uno|tanti}` in `translate`). Simulatore: 61,1% / 2,5%.
- Contenuti (2026-11-16, richiesta utente): **101 eventi**, obiettivo della prova raggiunto.
  I prossimi (verso 300) saranno della versione completa: da marcare e filtrare senza
  l'entitlement `full` (vedi M11).
- Tempo di gioco (2026-11-16, scelta utente tra 4 proposte): fatti **piano ricordato** e **avanti
  veloce**; scartati (per ora) meno momenti chiave per partita e meno notizie. Ripartizione misurata
  (prudente, 300 carriere): momenti 110 min, partite giocate 93, piano 72, notizie 68.
- M12 (2026-11-16): l'utente vuole **creare l'app ma non pubblicarla ancora**. Fatto: progetto
  Android, icona/splash dal codice, APK di debug (`pnpm android:apk`, vedi `docs/android.md`).
  Rimandati: chiave di firma (decisa: la creo io in `C:\Users\User\keys\`, password mostrata una
  volta), AAB firmato, scheda Play, verifica nomi (decisa: verificare "Outstanding" e proporre 2
  nomi). Package id deciso: `it.outstanding.calcio`.
- Strumenti di questa macchina (installati con il permesso dell'utente, fuori dal repo):
  `C:\Users\User\tools\android-sdk` (SDK) e `C:\Users\User\tools\jdk-21.0.13+9` (JAVA_HOME per
  Gradle; il JDK 17 e il 25 non vanno bene). Dettagli e insidie in [[android-build]].
- Nota M15: i prezzi dei beni sono alti rispetto agli stipendi dei dilettanti (si compra davvero
  solo dalla Serie Bronzo in su), ed è voluto.
- **Stato al 2026-11-16 (fine sessione):** M0–M17 + M12 prima parte fatte; 101 eventi; 239 test.
  APK di debug copiato sul desktop dell'utente come `C:\Users\User\Desktop\Outstanding.apk`
  (va ricopiato dopo ogni nuova build se l'utente lo chiede). L'utente deve ancora provarlo sul
  telefono: nessuna prova su dispositivo o emulatore finora.
- **Prossimi passi possibili (da proporre, non decisi):**
  - correggere ciò che l'utente trova provando l'APK sul telefono;
  - 2–3 alternative per l'icona (offerte: stemma con la "O", figurina del calciatore, prima pagina
    di giornale), se l'utente le vuole;
  - emulatore Android per provare io l'app (~2 GB, serve virtualizzazione: chiedere prima);
  - pubblicazione (firma, AAB, scheda Play, verifica nomi) solo quando l'utente lo chiede;
  - eventi della versione completa (verso 300), da marcare per l'entitlement `full`;
  - eventuale ritocco del tempo di gioco (meno momenti chiave) se dopo le prove serve ancora.
- Ritratto partner (M16): i capelli ricci femminili sulla fronte sembrano un cerchietto; segnalato
  all'utente, nessuna richiesta di modifica.
- `docs/TODO.txt` lo modifica l'utente: non includerlo nei commit. Anche
  `packages/app/src/app/ui/tip.component.ts` risulta modificato solo per gli a capo: non toccarlo.
- Stato git: tutto committato e pushato su `origin/dev` (main fermo a M2).

## Decisioni prese dall'utente (2026-11-16)

- Coppe: decide lo sviluppatore → nuova milestone **M7b – Coppe** (dopo M7, prima del simulatore,
  così il simulatore conta anche i trofei). Annotata in CLAUDE.md.
- Settimane senza partite: restano **giocabili oppure saltabili a scelta del giocatore**
  (serve una funzione tipo "salta alla prossima partita" quando arriva planWeek in M6).
- PDF del documento di progetto: **versionato** nel repository.

Collegato: [[world-design]], [[engine-design]], [[cups-design]], [[feedback-no-permission-prompts]]
