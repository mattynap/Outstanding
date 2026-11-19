# Changelog

Tutte le modifiche rilevanti del progetto. Formato ispirato a
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [Non rilasciato]

### Regista della partita (Parte A)

- Regista (`match/director.ts`): decide quando fermare la partita e quale momento proporre in base a
  tensione, posta in gioco e pressione; mai l'esito. Momenti con preavviso di un minuto, respiro dopo gol
  e catene, passo decisivo e riga di chiusura in pagella.
- Catene di momenti con "insisti o chiudi", conseguenze mostrate per ogni opzione (`onFail`, fascia di
  probabilità vera), stati dinamici (`dyn`), rischio contestuale e valore atteso delle opzioni.
- Momenti da leggenda: gesti rari e rischiosi nell'ultimo passo di una catena, al massimo uno a partita.
- Simulatore: strategie prudente, aggressiva, casuale e contestuale, opzioni `--isolate` (stesse scelte
  fuori campo), `--quality` e `--mode full|quick`, stima del tempo con i secondi in `simulator.json`.
- Modalità della partita: completa (5-7 passi) e rapida (1-2 passi); salvataggio v2 per tutta la Parte A.
- Taratura (A10): premio al successo delle opzioni rischiose +0,25 e fattori di punteggio GK 1,8 e DEF 1,0.
  Ritarata la formula del punteggio di carriera (`score.roleFactors` GK 2,33 -> 1,8, DEF 1,1 -> 1,0);
  `dyn.chanceWeight`, `risk.*` e `pressure.goalBoost` restano ai pesi iniziali perché guardrail e criterio già tenevano.
  A 5000 carriere, voto isolato contestuale 6,444 > prudente 6,313 > aggressiva 6,181 (differenza
  prudente-aggressiva 0,13). Guardrail della prudente contro la baseline A0: gol 50,6 (50,1), assist 56,6
  (61,1), trofei 0,77 (0,81), massima serie 59,2% (60,4%), leggende 3,54% (3,26%). Dettaglio in
  `reports/regista/confronto-A10.md`.
- Stima del tempo: completa circa 85 min a stagione e 29,5 h a carriera (sopra il bersaglio 20-30 min e
  6-8 h), rapida 22,5 min e 7,9 h; da decidere con l'utente.

### Regista della stagione (Parte B): simulatore a capitoli (B3)

- Simulatore: `--loop chapters|weeks`, default `chapters` (piano a inizio capitolo, notizie e offerte agli stop,
  di persona solo le partite scelte dal regista, le altre simulate da `advanceToStop`); `weeks` è il ciclo della
  Parte A e dà il nome file con `-weeks`. `pnpm sim:criterion` resta sul ciclo a settimane.
- Tempo di gioco: secondi grezzi per stagione, mediana (media, p10, p90) a stagione e a carriera nel riepilogo.
- Taratura: `calendar.chapterMatches.max` da 3 a 4. Mediana 20,1 minuti a stagione e 7,0 ore a carriera
  (5000 carriere prudente). I guardrail di carriera della prudente escono dalla tolleranza di A0 (gol 41,5,
  assist 42,5, trofei 0,64): le partite rapide hanno meno passi di quelle simulate. Dettaglio e cause in
  `reports/regista/stagione-B3.md`.

### Regista della stagione (Parte B): la partita rapida conserva l'apporto (B3b)

- Il budget del regista è lo stesso in ogni modalità (`match.steps` [5, 7], al posto di `match.modes`);
  `match.visibleSteps` [1, 2] è la quota di passi mostrati nella rapida. Gli altri passi si risolvono subito con
  `autoDecider` e qualità 0,5, come in `sim`, e nella cronaca hanno `auto: true`. Completa: tutti visibili;
  simulata: nessuno. Gesti da leggenda solo sui passi visibili.
- `DirectorState.visibleLeft` opzionale (assente = tutti visibili): nessun cambio di `saveVersion`.
- Simulatore: il tempo conta solo i passi visibili; il riepilogo riporta passi a partita visibili e totali.
- Effetto: gol e assist delle rapide tornano vicini alle simulate. Misure e guardrail in `reports/regista/stagione-B3.md`.

### Regista della stagione (Parte B): obiettivo del capitolo (B4)

- A ogni inizio di capitolo (non in preparazione) mister e procuratore assegnano un obiettivo scelto a peso
  da `content/data/chapter-goals.json` (25 obiettivi: titolare, gol, assist, voto medio, porta inviolata,
  gol in una partita scelta, posizione in classifica), filtrato con le stesse condizioni degli eventi e
  senza ripetere quello precedente. Il progresso si legge dal registro del capitolo.
- Liquidazione unica (`settleChapter`, idempotente) allo stop di fine capitolo e a fine stagione: se
  raggiunto, fiducia del mister e morale (`calendar.chapterGoals`), se mancato solo un piccolo calo di
  morale. L'esito è un titolo di prima pagina di tipo `event`; `SeasonReport.headlines` lo porta se la
  stagione chiude senza che sia già stato mostrato.
- Salvataggio v3: `chapter.goal` è `{ id, target, settled }` (nessun `baseline`).
- Il validatore dei contenuti controlla id, chiavi di testo e segnaposto degli obiettivi.
- Il simulatore riporta la percentuale di obiettivi raggiunti per metrica.
- Ritocchi ai testi: "Apri sulla fascia e accompagna", fallimento della doppia parata, righe di chiusura
  della pagella e titoli di prima pagina.

### Regista (revisione finale)

- Ripresa dei salvataggi v1 con una catena aperta e budget esaurito: il budget migrato copre i passi ancora possibili.
- `fastForward` chiude e apre i capitoli (obiettivo liquidato e nuovo estratto) con gli stessi passaggi di
  `advanceToStop`; con piano del capitolo vuoto si ripete il piano ricordato prima di `skipWeekPlan`.
- Tolto `match.moments.countByRole`, non più letto dal motore.

### Interfaccia ibrida giornale e pixel (ondata 2)

- Momenti chiave: ogni opzione dice cosa succede se va e se non va, con percentuale in pixel e
  barra a 10 tacche; il motore espone la conseguenza di ogni scelta senza cambiare gli esiti.
- Pagella come scontrino: voto in pixel e righe con le voci che lo compongono (base, contributi,
  risultato, arrotondamento), nuovi token `--o-ink-pos` e `--o-ink-neg` per la carta.
- Settimana come plancia: la partita in cima con stemmi grandi, "Gioca" nella scheda e scelta fra
  partita completa o simulata; la modalità predefinita si imposta in Impostazioni e resta salvata.
- Condizione con icone pixel, settimana e soldi in cifre pixel, notizie come striscia di prima pagina.
- Guida più corta: prima della prima partita solo benvenuto, pulsante principale e momenti chiave;
  condizione, piano e prepartita arrivano dopo la prima pagella.
- Notizie come prima pagina: titolo grande, scelte come pulsanti di carta, esito come ritaglio
  dell'"edizione successiva" con i valori firmati in pixel.

### Interfaccia ibrida giornale e pixel (ondata 1)

- Strato pixel nel tema: font Jersey 15 per i numeri, cornici a gradino e ombre piene fatte di
  box-shadow, nei temi scuro e chiaro.
- Icone pixel 16×16 disegnate dal codice per la barra e gli indicatori.
- Stemmi e maglie in pixel, con la stessa griglia degli sprite delle scene.
- Barra in basso a gradini: a inizio carriera tre voci, Mercato e Carriera compaiono quando servono
  e vengono annunciate una volta con il riquadro "Novità"; una voce vista non sparisce più.
  I salvataggi precedenti tengono tutte le voci.

### Scene in pixel art

- Campo partita e sala stampa ridisegnati in pixel art generata dal codice, con animazioni vere:
  corsa, tiro, rete che trema, coriandoli, fermo immagine e scritte a nastro.
- Spogliatoio con campanella, studio TV con pendolino e conferenza stampa con mezzobusti espressivi.
- Strumenti di regia comuni in `scenes/director.ts`; movimento ridotto mostra solo l'esito finale.

### Prima prova animata mobile

- Phaser 4.2.1 caricato su richiesta: campo pixel, esiti visivi dai dati del motore e tre scene originali.
- Comando del motore con qualità del tocco facoltativa, neutra a 0,5 e limitata da config; compatibilità
  delle scelte precedenti e simulazioni senza bonus conservata.
- Campo prova con quattro ruoli, separato dagli slot; alternativa testuale e movimento ridotto.
- Corretto il feedback dell’ultimo momento e la distinzione tra azione riuscita, gol, parata e recupero.
- Prima build firmata installata e aperta su iPhone 15; prove e limiti in `reports/prove-motore-mobile/README.md`.

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

### M11b – Editor

- Motore (`engine/src/world/edits.ts`): nome, nome breve, iniziali, colori e motivo della maglia
  dei club (italiani e stranieri); nome di calciatori delle rose, allenatori e procuratori; nome di
  campionati e coppe. Valori originali conservati in `GameState.edits`, ripristinabili uno per uno
  o tutti insieme; colori solo dalla tavolozza del gioco. Limiti in `config/data/editor.json`.
- Le correzioni valgono per la carriera (decisione dell'utente) e si salvano con lo slot.
- App: schermata "Redazione" (da Impostazioni) con schede Club, Persone, Competizioni e File;
  anteprima dal vivo di stemma e maglia; correzioni mostrate come su una bozza (nome originale
  barrato in rosso). I nomi delle competizioni sostituiscono le traduzioni in tutta l'app.
- File delle correzioni in JSON validato con Zod (`docs/editor-format.md`): esportazione con il
  menu di condivisione sul telefono o scaricamento nel browser; importazione che applica solo le
  voci con id e nome originale corrispondenti alla carriera.
- Nuova dipendenza: `@capacitor/share` (MIT).

### M13 – Basi (difficoltà, settimana guidata, modalità di gioco)

- Difficoltà facile / normale / difficile scelta alla creazione (`GameState.difficulty`, assente
  nei vecchi salvataggi = normale). Parametri in `config/data/difficulty.json`: crescita,
  infortuni, frequenza delle offerte, stipendi offerti e bonus sulle probabilità dei momenti
  chiave (decisione dell'utente: la difficoltà tocca anche le partite). Modulo
  `engine/src/difficulty.ts`.
- Simulatore: opzione `--difficulty`. Prudente, 1000 carriere, seme 42 (facile / normale /
  difficile): massima serie 71% / 62% / 52%, leggende 13% / 3,1% / 0,1%, media voto 6,37 / 6,24 /
  6,11. Normale invariata rispetto alla taratura di M8.
- Settimana guidata (decisione dell'utente): proposta in creazione quando non ci sono carriere
  salvate; dieci note del caporedattore sulle schermate (settimana, notizie, partita, pagella) fino
  alla prima partita, poi la scelta tra tenere la carriera o ricominciare. Si può saltare e
  riattivare dalle impostazioni.
- Impostazioni: modalità di gioco (testuale; "partite animate" visibile ma disattivata fino alla
  fase 2) e difficoltà della carriera.

### M14 – Personaggio

- Nuovo avatar in stile "figurina" (scelto dall'utente tra tre proposte): mezzo busto con braccia,
  corporatura (snella, atletica, robusta), forma e colore degli occhi, sopracciglia, naso, baffi,
  tre nuovi tagli (raccolti, con la riga, treccine), orecchini, catenina, fascia.
- Tatuaggi per zona (braccio sinistro, braccio destro, collo): sei motivi da subito, altri quattro
  sbloccati in carriera (età, presenze, esordio in massima serie, primo trofeo; decisione
  dell'utente). Catalogo e condizioni in `content/data/avatar.json`.
- Invecchiamento visibile facoltativo: capelli e barba ingrigiscono, poi la fronte si stempia.
- Motore: `engine/src/player/look.ts` (`changeLook`, `lookChangeCost`, `tattooUnlocked`); le parti
  fisse (carnagione, viso, occhi, naso, corporatura) non cambiano in carriera. Costi in
  `config/data/look.json`. I salvataggi precedenti si completano con valori predefiniti; le parti
  nuove non consumano estrazioni casuali, quindi lo stesso seme dà ancora lo stesso mondo.
- App: editor dell'aspetto a gruppi nella creazione e nuova schermata "Barbiere e tatuatore"
  (dal profilo, "Cambia look") con anteprima prima/dopo e conto.

### M15 – Finanze

- Patrimonio (`GameState.finance`, motore in `engine/src/finance/finance.ts`, parametri in
  `config/data/finance.json`), con le decisioni dell'utente:
  - conto deposito a interesse fisso;
  - mercato con prezzi settimanali di tre titoli inventati (Fondo Quieto, Indice Penisola,
    Lirabit) a rischio crescente, con crolli e rialzi improvvisi; commissione su ogni operazione;
  - otto beni (dal monolocale allo yacht) con mantenimento settimanale, felicità, popolarità
    all'acquisto e valore che si rivaluta (immobili) o si svaluta (auto e barche); rivendibili;
  - cinque attività (bar, scuola calcio, ristorante, palestra, marchio di abbigliamento) con nome
    scelto dal giocatore, andamento 0–100, rendita legata alla popolarità, perdite e chiusura;
  - mutuo per gli immobili e prestito personale, concessi solo con contratto e rate entro il 40%
    dello stipendio; dopo quattro rate saltate la banca pignora.
- Il mercato usa un generatore ricavato da seme e settimana: non tocca il resto della carriera
  (simulatore invariato: massima serie 61,9%, leggende 3,1%).
- Eventi: nuova categoria "Affari", condizione `business`, segnaposto `{business}`, effetto
  `business` sull'andamento dell'attività principale; cinque notizie nuove.
- App: schermata "Patrimonio" (da Finanze e vita) con riepilogo, deposito, mercati con grafico
  dei prezzi toccabile, beni e attività con vignette illustrate disegnate dal codice, banca. Il
  saldo della settimana comprende rendite, mantenimento e rate.

### M16 – Vita privata

- Vita privata (`GameState.privateLife`, motore in `engine/src/private/private.ts`, parametri in
  `config/data/private.json`, nomi e mestieri in `content/data/private.json`), con le decisioni
  dell'utente:
  - orientamento scelto alla creazione ("ti interessano: donne / uomini / entrambi"),
    modificabile nelle impostazioni;
  - una azione privata a settimana, fuori dal piano di allenamento: uscire a conoscere gente,
    chiedere un appuntamento, cena, regalo, vacanza (solo nelle settimane senza partite), proposta,
    matrimonio, allargare la famiglia, giornata con i figli; costi scalati sullo stipendio;
  - relazione con intesa 0–100 che cala piano: sotto 25 la coppia è in crisi (la felicità cala), a
    zero il partner se ne va;
  - figli con nome, età e spese settimanali; dopo una separazione vivono con l'altro genitore e si
    paga l'assegno; il divorzio costa il 30% di cassa e deposito;
  - storie segrete che nascono dagli eventi e possono essere scoperte (più facile se si è famosi):
    gossip, crisi, possibile separazione;
  - "Serata" come nuova azione del piano settimanale: morale e felicità su, energia e forma giù,
    rischio gossip e, se in settimana c'è una partita, multa del club.
- Eventi: nuova categoria "Cuori", condizioni `relationship`, `affinity`, `children`, `affair`,
  segnaposto `{partner}` e `{child}`, effetti `partner`, `meet`, `affair`, `breakup`; eventi che il
  motore fa arrivare da solo (`trigger`: tradimento scoperto, nascita, partner che se ne va).
  Diciannove notizie nuove (46 in tutto), tono allusivo da PEGI 12.
- App: schermata "Vita privata" (da Finanze e vita) in stile cronaca rosa, con ritratto del
  partner disegnato dal codice, intesa, famiglia, storie passate e azioni con vignette; scelta
  dell'orientamento in creazione e nelle impostazioni; avvisi di gossip e multa dopo la serata.
- Simulatore (prudente, 1000 carriere, seme 42): massima serie 61,2% (prima 61,9%), leggende 3,0%
  (prima 3,1%): cambia solo l'estrazione delle notizie.

### M17 – Media

- Media (`GameState.media`, motore in `engine/src/media/media.ts`, parametri in
  `config/data/media.json`, nomi utente e varianti in `content/data/media.json`), con le decisioni
  dell'utente:
  - follower che seguono la popolarità, crescono con i post e calano con gli scandali; **valgono
    soldi**: sponsor più frequenti e meglio pagati, più clienti per le attività;
  - un post a settimana (allenamento, vita privata, beneficenza, provocazione); la provocazione
    porta molti follower ma può finire in polemica;
  - feed con i commenti dei tifosi (risultato, gossip, nascite, trasferimenti), i propri post e i
    titoli del giornale; usa un generatore suo e non cambia il resto della carriera;
  - intervista facoltativa dopo le partite giocate di persona: una domanda legata a risultato e
    voto, tre toni (umile, sicuro, polemico) o "nessun commento";
  - conferenza stampa prima di semifinali e finali di coppa, derby e scontri al vertice, e alla
    presentazione nel nuovo club: le risposte toccano morale, allenatore e immagine e, prima di una
    partita, le probabilità dei momenti chiave (al massimo ±5%).
- App: schermata "Social" (icona nella settimana o follower del profilo), schermata "Conferenza
  stampa" con una domanda alla volta, intervista nella pagella di fine partita.
- Testi: singolare e plurale con `{n|offerta|offerte}`; corretti "1 offerte", "1 settimane" e
  simili.
- Simulatore (prudente, 1000 carriere, seme 42): massima serie 61,1%, leggende 2,5% (prima 3,0%):
  gli sponsor ora dipendono dai follower e cambiano la sequenza del caso; differenza nel rumore.

### Contenuti – 101 eventi

- 55 notizie nuove (da 46 a 101), obiettivo della versione di prova raggiunto: spogliatoio 17,
  allenamento 13, media 12, mercato 9, vita 14, famiglia 11, affari 8, cuori 17.
- Nuove catene: il cucciolo adottato che, qualche settimana dopo, distrugge le scarpe nuove.
- Guida di stile aggiornata con categorie, condizioni, effetti e segnaposto arrivati in M15–M17.
- Simulatore (prudente, 1000 carriere, seme 42): massima serie 60,6%, leggende 3,2%, tempo di
  gioco invariato (le notizie a settimana non aumentano).

### M12 (prima parte) – App Android

- Progetto Android di Capacitor (`packages/app/android/`), identificativo `it.outstanding.calcio`,
  versione 0.1.0, Android 7 (API 24) e successivi, target API 36.
- Icona e schermata d'avvio disegnate dal codice (`packages/app/assets/make-art.mjs`) e generate in
  tutte le misure con `@capacitor/assets`, icona adattiva compresa.
- Script `pnpm android:apk` (APK di debug) e `pnpm android:assets`; istruzioni in
  `docs/android.md`.
- Schermo intero: il contenuto delle pagine non finisce più sotto la barra di stato.
- La pubblicazione su Google Play è rimandata (decisione dell'utente).

### Tempo di gioco

- Piano ricordato: `planWeek` salva l'ultimo piano scelto (`GameState.lastPlan`) e la settimana lo
  ripropone già selezionato; i piani automatici (settimane saltate, avanti veloce) non lo
  sostituiscono.
- Avanti veloce (`fastForward`, `engine/src/season/fastForward.ts`): fino alla prossima partita
  importante (le stesse delle conferenze stampa) o a fine stagione. Ripete il piano senza le
  serate, sceglie la risposta più prudente alle notizie (`prudentChoice`), simula le partite. Si
  ferma per offerte che contano (rinnovo, categoria superiore, giocatore senza squadra), per le
  notizie personali (tradimento scoperto, nascita, partner che se ne va) e a fine carriera.
- Stima: il piano ricordato toglie circa metà del tempo della pianificazione (~35 min a carriera);
  l'avanti veloce dipende da quanto lo si usa (una stagione intera in pochi secondi).
