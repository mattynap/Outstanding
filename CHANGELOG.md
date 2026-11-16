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

### M6 – Progressione

- Piano della settimana (`getWeekOptions`, `planWeek`): 2 azioni a scelta tra allenamento,
  allenamento intenso, allenamento mirato su un'abilità, riposo, fisioterapia, svago e famiglia.
  Da infortunati gli allenamenti non sono disponibili.
- Crescita delle abilità (con decimali) da allenamenti e minuti giocati, modulata da età,
  distanza dal potenziale nascosto, disciplina ed energia; tetto per singola abilità.
- Declino di fine stagione dopo i 31 anni, più rapido per velocità e fisico, attenuato dalla
  disciplina.
- Condizione: la partita consuma energia e cambia forma, morale e fiducia del mister in base a voto,
  convocazione e risultato; a fine settimana energia, forma, morale e rischio tornano verso i valori
  di riferimento.
- Infortuni in partita e negli allenamenti intensi, con probabilità legata a rischio accumulato ed
  energia; sei tipi con durate diverse; la fisioterapia può accorciare lo stop.
- `skipToNextMatch`: salta le settimane senza partite con un piano automatico.
- Tutti i parametri in `config/progression.json`. Curva verificata su carriere complete: potenziale
  raggiunto verso i 25–26 anni, picco fino ai 30–31, declino dai 32.

### M7 – Economia e mercato

- Offerte dei club nelle finestre di mercato (e in ogni momento da svincolato): club di livello
  vicino, preferibilmente superiore, con rating compatibile con l'OVR percepito (bonus ai giovani,
  sconto dopo i 30 anni). Stipendio per livello da `config/economy.json`, bonus alla firma.
- Trattativa: il club accetta entro un tetto nascosto, rilancia a metà strada o ritira l'offerta.
- Rinnovo proposto dal club nell'ultima stagione di contratto se il giocatore è all'altezza (la
  fiducia del mister aiuta). Contratti scaduti a fine stagione: svincolo.
- Prestiti per i giovani poco utilizzati, con rientro automatico a fine stagione.
- Procuratore: candidati in base alla reputazione, qualità da 1 a 5, commissione, più offerte e
  più margine nelle trattative; segnaposto `{agent}` ed effetti sul rapporto attivi negli eventi.
- Sponsor con marchi inventati (`content/data/sponsors.json`) che arrivano con la popolarità, pagano
  ogni settimana e sbloccano l'azione "servizio per lo sponsor".
- Finanze settimanali (stipendio, sponsor, commissione, tenore di vita a tre livelli), debiti che
  pesano su felicità e morale.
- Ritiro deciso dal mercato: automatico a 40 anni o dai 33 se si resta senza squadra a fine
  mercato estivo; ritiro volontario dai 33. Le richieste di trasferimento degli eventi diventano
  offerte.
- Gli aumenti di abilità dati dagli eventi rispettano ora il potenziale nascosto.
- Verifica su 12 carriere complete: 10 arrivano in massima serie (non quelle con potenziale ~60),
  ritiro tra 33 e 39 anni.

### M7b – Coppe

- Coppa Tricolore: 100 club professionistici più i 28 più forti della Lega Interzonale, 8 turni a
  gara secca; le squadre più deboli entrano per prime, la massima serie dal terzo turno; gioca in
  casa la squadra di categoria inferiore; finale in campo neutro.
- Coppa Europa Maior (1ª–4ª della massima serie) e Minor (5ª–6ª più la vincitrice della Coppa
  Tricolore, o la prima non qualificata): 32 squadre, 8 gironi da 4 con andata e ritorno, poi
  ottavi, quarti e semifinali andata e ritorno e finale secca in campo neutro. Nella prima stagione
  si qualificano i club più forti.
- 66 club stranieri inventati in 6 paesi (`content/data/foreign.json`): città europee reali, nomi
  dei club da affisso del paese + epiteto inventato, rose con nomi del paese, stemmi e maglie
  procedurali, due fasce di forza. Stanno in `world.foreignClubs`, fuori dalla piramide e dal mercato.
- Sorteggi deterministici: gironi per fasce senza due club dello stesso paese, prime dei gironi
  contro seconde di un altro girone (ritorno in casa delle prime).
- Supplementari e rigori nelle gare decisive in parità (anche nella partita del giocatore).
- Partite infrasettimanali: nella stessa settimana il club può giocare campionato e coppa;
  `playerFixture` restituisce la prossima partita non giocata, `playerFixtures` tutte.
- Trofei nello storico (`SeasonRecord.trophies`: campionato vinto e coppe), vincitrici nel
  riepilogo di fine stagione, classifiche dei gironi (`cupGroupTables`).
- Parametri in `config/cups.json` con controlli incrociati su calendario e piramide.
- Verifica su 60 stagioni: la Coppa Tricolore la vince quasi sempre un club di massima serie; le
  italiane vincono la Maior nel 5% dei casi e la Minor nel 20%. Salvataggio iniziale ~1,3 MB
  (da ottimizzare in M10).

### M8 – Simulatore

- `pnpm sim --careers N --strategy cautious|aggressive|random|all --seed S [--workers N]
[--out dir] [--details]`: gioca carriere complete senza interfaccia, in parallelo su più thread,
  stampa una tabella e scrive un riepilogo JSON in `sim-output/`.
- Strategie: prudente (allenamento normale, opzione più sicura, un livello alla volta), aggressiva
  (allenamento intenso e mirato, opzione più rischiosa, sempre il livello più alto), casuale.
- Metriche, in totale e per ruolo: % in massima serie, età di esordio, stagioni in massima serie,
  presenze, gol, assist, media voto, OVR massimo, trofei per tipo, età e motivo del ritiro,
  punteggio, fasce di giudizio, % leggende, tempo di gioco stimato.
- Punteggio di carriera nel motore (`careerScore`, `careerTotals`, `isLegend`): presenze, gol,
  assist, porte inviolate e voti pesati per livello, più i trofei; cinque fasce, l'ultima è la
  "leggenda". Parametri in `config/career.json`.
- Prima misurazione (5000 carriere per strategia, seme 42): prudente 70% in massima serie (esordio
  a 26,6 anni), 9,8% leggende quasi tutte attaccanti, ritiro a 38,6 anni, ~10 ore di gioco stimate;
  aggressiva 70% in massima serie ma media voto 5,4 e nessuna leggenda; casuale 3,5% in massima
  serie. Problemi di bilanciamento da tarare insieme all'utente (vedi memoria `progress`).

### Taratura dopo M8

- Partita simulata (`simulateMatch`): il giocatore sceglie per ogni partita se giocarla o
  simularla; nella simulata i momenti chiave usano la scelta automatica prudente (`autoDecider`).
  Il simulatore gioca di persona coppe e partite contro avversari forti almeno quanto la propria
  squadra.
- Momenti chiave: un tiro riuscito non è più un gol sicuro (il portiere può parare), tetto delle
  probabilità al 90%, 2–4 momenti per partita; il valore atteso delle opzioni di ogni momento è
  pareggiato a un livello tipico, così il rischio conviene solo a chi è più forte dell'avversario.
- Voti dei portieri: meno penalità per gol subito, più premio per la porta inviolata.
- Eventi: circa 12 a stagione invece di 32.
- Crescita: chi è lontano dal proprio potenziale cresce più in fretta (`maxGapFactor`); i talenti
  da 85–90 arrivano a OVR 80–83 invece di fermarsi a ~70.
- Mercato: penalità d'età delle offerte raddoppiata dopo i 30 anni (ritiro medio a 37 anni).
- Punteggio di carriera con fattori per ruolo (`roleFactors`) e fasce ritarate.
- Risultati (5000 carriere, seme 42), prudente / aggressiva / casuale: massima serie 61% / 62% /
  3%, esordio 25,5 / 23,1 / 28,8 anni, leggende 2,7% / 0,5% / 0% (prudente: 2,3–3,6% per ruolo),
  ritiro 37 / 37,6 / 36,9 anni, media voto 6,23 / 5,75 / 6,18. Tempo di gioco stimato: ~3 ore
  simulando tutte le partite, ~6 giocando quelle importanti, ~7 giocandole tutte.

### M9 – App (UI)

- App Angular 22 + Ionic 9 + Capacitor 8 in `packages/app` (componenti standalone, segnali),
  collegata al motore tramite `GameService`, che salva in automatico dopo ogni azione (un solo slot,
  Capacitor Preferences; slot multipli e migrazioni in M10).
- Design system (`docs/design-system.md`, `src/theme/tokens.css`, `src/theme/components.css`):
  campo verde scuro, carta di giornale per notizie e pagelle, accento oro, Barlow Condensed + Inter
  inclusi nell'app; tema scuro predefinito e tema chiaro.
- Grafica dal codice: stemmi SVG (forma, colori, 16 simboli, iniziali), maglie, avatar componibile.
- Aspetto del giocatore nel motore (`Player.appearance`: carnagione, capelli, colore, viso, barba)
  con le parti in `content/data/avatar.json`.
- Schermate: inizio, creazione giocatore, settimana (piano, prossima partita, notizie, salta alla
  partita), evento come notizia con conseguenze, partita (gioca o simula, momenti chiave con
  probabilità, pagella e tabellino), fine stagione, profilo (abilità, tratti, crescita, contratto),
  mercato (offerte, trattativa, procuratore, sponsor), finanze e vita (tenore di vita, ritiro),
  classifica e coppe, carriera (punteggio, bacheca, stagioni), fine carriera, impostazioni.
- Testi dell'interfaccia in `content/data/i18n/it.ui.json`; test che verifica ogni chiave usata.
- Il motore esporta anche `applyWeeklyFinances` (anteprima delle finanze settimanali).

### M10 – Salvataggi

- Tre slot di salvataggio: un file per carriera (Capacitor Filesystem, nella memoria privata
  dell'app; IndexedDB nel browser) e un indice con i riepiloghi (Capacitor Preferences).
- Salvataggio automatico dopo ogni azione, quindi anche a ogni settimana, con una coda che scrive
  sempre l'ultimo stato una volta sola; avviso in caso di errore di scrittura.
- Scrittura sicura: file temporaneo poi spostamento; se l'app si chiude a metà si recupera il
  temporaneo.
- File compressi (gzip + base64 con intestazione `OSV1:`): da ~1,3 MB a ~215 KB, ~30 ms su PC.
  Si leggono anche i salvataggi JSON semplici.
- Migrazioni: il motore porta ogni salvataggio alla versione attuale (`saveVersion`); un salvataggio
  rovinato o di una versione più recente viene segnalato senza essere cancellato. Il salvataggio
  unico di M9 viene spostato da solo nel primo slot libero.
- Schermata iniziale con le carriere salvate (giocatore, club, stagione, settimana, data), pulsante
  "Continua" sull'ultima giocata, eliminazione con conferma; all'avvio si riapre l'ultimo slot.
- La creazione della carriera indica lo slot di destinazione e avvisa se ne sostituisce una.

### M11 – Servizi

- Interfacce per statistiche d'uso (`AnalyticsSink`), pubblicità a premio (`RewardedAds`) e
  acquisti in-app (`Store`) in `packages/app/src/app/core/services`, con implementazioni finte
  (console, pubblicità non disponibile, negozio senza pagamenti) e un unico punto di sostituzione
  (`PlatformService`).
- Statistiche anonime solo con consenso esplicito nelle impostazioni (spente di base): inizio
  carriera, fine stagione, ritiro, acquisto. Nessun nome né dato personale.
- Acquisti: un solo prodotto, "Versione completa" (non consumabile, ripristinabile), senza
  vantaggi in carriera. Il blocco dei contenuti tra prova e completa arriverà con i 100 eventi.
- Pubblicità a premio: solo interfaccia, nessun premio nel gioco (decisione dell'utente).
