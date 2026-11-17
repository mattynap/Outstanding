# UI e UX: giornale sportivo con strato pixel ("ibrido spinto")

Data: 2026-11-17 · Stato: approvata · Fonti: conversazione con l'utente, design meccaniche
`2026-11-17-meccaniche-gioco-design.md`, report di psicologia del giocatore e Kuroko, scene pixel
approvate (`2026-11-17-pixel-art-scene-design.md`), `docs/design-system.md` attuale.

## 1. Perché

L'utente vuole che Outstanding sembri un **gioco** e non un simulatore da leggere. Le scene in pixel
art (campo e sala stampa) gli sono piaciute; ora l'interfaccia intorno deve parlare la stessa lingua
senza perdere l'identità "giornale sportivo italiano". Scelta dell'utente: **ibrido spinto, mantenendo
lo stile di giornale**.

## 2. Obiettivi, non obiettivi, anti-obiettivi

**Obiettivi**
- Un solo linguaggio visivo: carta di giornale e titoli condensati + cornici, icone, numeri e stemmi
  in pixel, coerenti con le scene Phaser.
- Le correzioni di UX emerse ieri (§5) applicate al giro di gioco: settimana → partita → pagella →
  notizie.
- Design system aggiornato (`docs/design-system.md` + `theme/`) come unica fonte, così le schermate
  delle meccaniche M18–M23 nascono già nello stile nuovo.

**Non obiettivi**
- Le meccaniche nuove (gradi, obiettivi, album, rivale, business idle, classifiche): arrivano con le
  loro milestone. Qui non si disegnano schermate vuote o finte per loro.
- La modalità partita "rapida" nel motore (è M18): la UI prevede il posto, il motore la aggiunge dopo.
- Avatar in pixel (vedi §7).

**Anti-obiettivi**
- Testi lunghi in font pixel: notizie, contratti e descrizioni devono restare comodi da leggere.
- Effetto "app gestionale con skin retrò": cornici pixel appiccicate a schede che restano tabelle.
- Rompere l'accessibilità: contrasto, aree di tocco 44 px, "riduci movimento", tema chiaro.
- Introdurre asset esterni senza licenza chiara.

## 3. Vincoli

- Angular + Ionic esistenti, token in `packages/app/src/theme/tokens.css`, classi `o-*` in
  `components.css`. Si estende, non si riscrive da zero.
- Ogni schermata passa dalla skill `frontend-design` prima del codice (CLAUDE.md §10).
- Font solo OFL, inclusi con `@fontsource`, registrati in `ASSETS.md`.
- Testi visibili solo tramite `it.ui.json`. Mobile first 360–430 px.
- Il motore resta puro; i dati nuovi per la UI (spiegazione del voto) entrano come campi
  aggiuntivi e facoltativi dei report, con test.

## 4. Linguaggio visivo

| Strato | Cosa | Come |
|---|---|---|
| Giornale (resta) | notizie, pagelle, fine stagione, interviste, cronaca rosa | carta `--o-paper`, testata con doppio filetto, occhiello rosso, Barlow Condensed per i titoli |
| Testo (resta) | descrizioni, scelte, contratti | Inter |
| Pixel (nuovo) | numeri grandi (settimana, voto, OVR, percentuali, soldi), cornici di schede e pulsanti, icone della barra in basso e degli stati, stemmi e maglie | font pixel OFL solo da 20 px in su; cornici ad angoli a gradini; ombre piene senza sfocatura; SVG con `shape-rendering: crispEdges` |

Regole:
- **Cornice pixel**: angoli a gradino di 4 px (clip-path o border-image), bordo pieno 2 px, ombra
  piena spostata di 4 px nel colore del fondo scurito. Una sola scala per tutte le schede e i
  pulsanti; la carta di giornale ha la stessa cornice ma nei suoi colori.
- **Pulsante principale**: oro, cornice pixel, si "abbassa" di 2 px al tocco (l'ombra si riduce),
  150 ms.
- **Numeri**: font pixel (proposta: Pixelify Sans, OFL) per voto, settimana, OVR, percentuali e
  cifre dei soldi; Barlow Condensed per i titoli; mai pixel sotto i 20 px.
- **Icone pixel** 16×16 disegnate dal codice (componente unico, griglie come dati) per barra in basso,
  forma/energia/morale, soldi, notizie, partita. Ionicons resta per le icone di servizio (indietro,
  chiudi, impostazioni).
- **Stemmi e maglie** passano alla resa pixel, con la stessa logica dei disegni Phaser, così lo
  stemma in Home è lo stesso che si vede nella sala stampa.
- Palette invariata (verde campo, oro, carta, rosso occhiello); i colori pixel vengono dagli stessi
  token.
- Movimento: entrate a scatti (2–3 passi) per numeri e cornici, sempre 150–300 ms, spente con
  "riduci movimento".

## 5. Correzioni di UX

1. **Settimana come plancia di gioco.** In alto settimana e soldi in pixel; subito sotto la
   **prossima partita** come scheda principale con un solo grande pulsante "Gioca" e la scelta della
   modalità (Completa / Simula, più Rapida quando c'è nel motore; predefinito nelle impostazioni).
   Piano della settimana e notizie dopo, più compatti. L'avanti veloce smette di essere la via
   naturale.
2. **Momento chiave leggibile.** Ogni opzione: nome, percentuale grande in pixel, una riga di
   conseguenza ("Se va: gol · Se no: contropiede"). La scena animata resta sopra, le opzioni sotto,
   a portata di pollice.
3. **Pagella che spiega il voto.** Voto grande in pixel su carta; sotto, le voci che lo hanno
   formato come uno scontrino (base 6, gol +1, momento sbagliato −0,5, sconfitta −0,5...). Serve un
   campo nuovo nel report della partita (§3).
4. **Prima sessione più corta.** Le note del caporedattore prima della prima partita scendono a 3
   (le altre compaiono dopo, al momento giusto); nella prima settimana la partita è l'azione evidente,
   così il primo momento chiave arriva entro 1–2 minuti dalla creazione.
5. **Funzioni a gradini.** La barra in basso mostra all'inizio solo Settimana, Profilo e Classifica;
   Mercato compare alla prima finestra di mercato, Carriera alla fine della prima stagione; le voci
   della vita (patrimonio, vita privata, social) si aprono con le condizioni che già le regolano. Ogni
   sblocco è annunciato una volta con un riquadro "Novità". Regola calcolata dallo stato, nella app.
6. **Notizie come prima pagina.** L'evento resta una pagina di giornale, con titolo più grande,
   scelte come pulsanti pixel sulla carta ed esito mostrato come "edizione successiva" (breve
   ritaglio con gli effetti scritti).

## 6. Approcci

| Approccio | Pro | Contro |
|---|---|---|
| **A. Design system v2, poi giro di gioco, poi il resto a ondate** | ogni ondata provabile su iPhone; le schermate nuove riusano subito il sistema | il resto dell'app resta misto per qualche giorno |
| B. Solo stile su tutte le schermate, UX dopo | tutto cambia aspetto in fretta | le correzioni, che sono il motivo, aspettano |
| C. Una schermata alla volta senza sistema comune | si vede subito il primo risultato | dopo poche schermate diventa incoerente |

**Scelto: A** (l'utente ha detto "procedi", scelta mia).

Ondate:
1. **Sistema**: token e classi pixel, font, icone pixel, stemmi e maglie pixel, barra in basso a
   gradini, aggiornamento di `docs/design-system.md`.
2. **Giro di gioco**: Settimana, Partita (pre, momenti, cronaca), Pagella con spiegazione, Evento.
   Prova su iPhone e approvazione dell'utente prima della terza ondata.
3. **Resto**: Profilo, Carriera, Classifica, Stagione, Mercato, Vita, Patrimonio, Vita privata,
   Social, Conferenza, Crea, Avvio, Fine carriera, Impostazioni, Editor.

## 7. Decisioni prese da me, da controllare

- Font pixel: Pixelify Sans (OFL), solo per numeri e titoletti da 20 px in su; Inter resta per i testi.
- Avatar del giocatore resta vettoriale (stile scelto in M14), dentro una cornice pixel; un avatar
  pixel si valuta dopo.
- Icone pixel disegnate dal codice, Ionicons solo per le icone di servizio.
- Ordine dello sblocco a gradini della barra (§5.5).
- Note guida prima della prima partita ridotte da 10 a 3.
- Modalità partita: scelta per partita con predefinito nelle impostazioni; "Rapida" appare quando M18
  la aggiunge al motore.

## 8. Lasciato a chi costruisce

Tecnica esatta delle cornici (clip-path, border-image o SVG); griglie delle icone; condivisione del
codice di disegno pixel fra Phaser e SVG; testi delle conseguenze nei momenti (da chiavi esistenti o
nuove); nomi e formato delle voci della pagella nel motore; dettagli di ogni schermata con la skill
`frontend-design`, dentro questi token.

## 9. Verifica

Per ogni ondata: typecheck, test, lint, content:check verdi; screenshot a 390 px in tema scuro e
chiaro; installazione su iPhone 15; nessun testo hard-coded (test chiavi i18n); contrasto AA sui
pulsanti; "riduci movimento" rispettato.
