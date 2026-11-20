# Design system

Unica fonte di verità per stile, colori, tipografia, spaziature e componenti dell'app.
Il codice vive in `packages/app/src/theme/`: `tokens.css` (token) e `components.css` (classi `o-*`).
Ogni nuova schermata usa questi token e queste classi; gli stili locali dei componenti servono solo
per la disposizione.

## Direzione visiva

"Giornale sportivo italiano incontra app moderna", approvata dall'utente con l'anteprima del
2026-11-16:

- **Campo**: lo sfondo è un verde scuro con le strisce del taglio dell'erba (`ion-content.o-page`).
- **Carta di giornale**: notizie (eventi), pagelle, fine stagione e fine carriera sono pagine di
  "Il Pallone di Provincia" (testata inventata): carta color avorio, inchiostro scuro, testata con
  doppio filetto, occhiello rosso, titoli condensati maiuscoli.
- **Accento oro** per l'azione principale e le selezioni; verde per i valori buoni, rosso per
  quelli critici.
- Numeri grandi in carattere condensato: settimana, punteggio, voto in pagella, OVR.

Dal 2026-11-17 l'utente ha scelto l'**ibrido spinto** (spec
`docs/superpowers/specs/2026-11-17-ui-ux-ibrido-design.md`): il giornale resta, sopra si aggiunge uno
strato pixel coerente con le scene Phaser.

| Strato           | Cosa                                                                       | Come                                                          |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Giornale (resta) | notizie, pagelle, fine stagione, interviste                                | carta, testata a doppio filetto, occhiello rosso, Barlow      |
| Testo (resta)    | descrizioni, scelte, contratti                                             | Inter                                                         |
| Pixel (nuovo)    | numeri grandi, cornici di schede e pulsanti, icone di stato, stemmi/maglie | Jersey 15 da 20 px in su, cornici a gradino, SVG `crispEdges` |

## Token (`tokens.css`)

| Gruppo    | Token                                                                  | Scuro (predefinito)                        | Chiaro                           |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------ | -------------------------------- |
| Sfondo    | `--o-bg`, `--o-bg-deep`                                                | `#0B1F15`, `#081810`                       | `#EEF1E7`, `#E2E7D9`             |
| Superfici | `--o-surface`, `--o-surface-raised`                                    | `#10291C`, `#1B4D2E`                       | `#FFFFFF`, `#D9EAD9`             |
| Bordi     | `--o-border`, `--o-border-strong`                                      | `#22432F`, `#2A5A3C`                       | `#CFD8C8`, `#A9BFA9`             |
| Testo     | `--o-text`, `--o-text-muted`, `--o-text-soft`                          | `#EEF2EA`, `#A9BBAE`, `#CFE3D4`            | `#12261A`, `#4C6052`, `#2F4A38`  |
| Accento   | `--o-accent` (fondo), `--o-accent-fg` (testo/icone), `--o-accent-soft` | `#F2B830`                                  | fondo `#F2B830`, testo `#8A5F00` |
| Esiti     | `--o-positive`, `--o-negative`                                         | `#5BD08A`, `#E5484D`                       | `#1D7F45`, `#C42B30`             |
| Giornale  | `--o-paper`, `--o-ink`, `--o-ink-muted`, `--o-headline-red`            | `#F1EBDD`, `#1A1A17`, `#4A4740`, `#B3261E` | uguali                           |
| Su carta  | `--o-ink-pos`, `--o-ink-neg` (bene e male sul fondo carta, AA)         | `#1D6B3C`, `#B3261E`                       | uguali                           |

Regola di contrasto: l'oro come **fondo** va con testo `--o-accent-ink`; come **colore del testo**
si usa sempre `--o-accent-fg` (nel tema chiaro è scurito per restare leggibile).

Tema: scuro predefinito; il chiaro si attiva con `data-theme="light"` su `<html>`
(`SettingsService`). Le variabili di Ionic (`--ion-*`) sono collegate ai token.

## Tipografia

- **Barlow Condensed** (500–800): titoli, numeri, pulsanti, testate. Maiuscolo per titoli e testate.
- **Inter** (400–600): testi, etichette, descrizioni.
- Entrambi con licenza SIL OFL, inclusi nell'app con i pacchetti `@fontsource` (solo alfabeto
  latino), mai da CDN. Vedi `ASSETS.md`.
- Scala: etichette 11 px maiuscole spaziate (`.o-label`), testo 12–16 px, titoli di sezione 19 px,
  titoli di giornale 40–46 px, numeri grandi 56–72 px.

- **Jersey 15** (400): numeri grandi in pixel (settimana, voto, OVR, percentuali, cifre dei
  soldi), classe `.o-num`; anche `.o-number.big` e `.o-stat__value`. Mai sotto i 20 px. Scelto al
  posto di Pixelify Sans perché in quello il 5 è identico alla S ("6,5" si leggeva "6,S") e l'euro
  è illeggibile; Jersey 15 ha virgola, più, meno tipografico (U+2212), % ed euro leggibili.

## Strato pixel

- Un pixel dell'interfaccia vale `--o-px` (2 px); l'ombra piena è spostata di `--o-px-drop` (4 px)
  e ha il colore `--o-px-shadow` (scuro `#04100A`, chiaro `#A9BFA9`). Nessuna sfocatura.
- **Cornice**: solo `box-shadow` piene. Quattro copie spostate di un pixel fanno il bordo e lasciano
  vuoti gli angoli (il gradino); due copie spostate fanno l'ombra a gradino. Niente `clip-path`,
  che taglierebbe l'ombra. Si applica da sola a `.o-card`, `.o-choice`, `.o-paper`, `.o-btn`,
  `.o-chip`, `.o-input`, `.o-icon-btn`, `.o-stat--boxed`, oppure con `.o-px` a qualunque elemento.
- Colore del bordo con `--px-b` sull'elemento: `--o-border` per le schede, `--o-border-strong` per
  hero, scelte e pulsanti secondari, oro scuro `#8A6510` per il pulsante principale, accento per le
  selezioni, inchiostro `--o-px-paper-edge` per la carta. Elementi piccoli hanno ombra di 2 px.
- `.o-px--paper`: pulsanti e riquadri sulla carta (fondo `--o-paper`, testo e bordo inchiostro);
  si somma a `.o-choice` per le risposte alle notizie.
- **Pressione**: pulsanti, scelte e chip scendono di un pixel e l'ombra sparisce (150 ms, 2 scatti).
- **Entrata a scatti** `.o-enter-steps`: 220 ms in 3 passi; spenta con "riduci movimento".
- Raggi: lo strato pixel azzera i raggi di schede, scelte e pulsanti; restano tondi solo stemmi,
  avatar e barre.
- **Icone pixel** `<app-px-icon name size>`: griglie 16×16 come dati in `ui/px-icons.ts` (`#` colore
  corrente, `o` dettaglio scuro, `+` riflesso), mostrate a 16, 24 o 32 px. Barra in basso, stati,
  soldi, notizie, partita, stampa, "novità". Ionicons resta solo per le icone di servizio.
- **Stemmi e maglie** in pixel (`ui/pixel-crest.ts`): stessa griglia, contorno e carattere delle
  scene Phaser (`scenes/pix.ts`). Stemma 22×26, maglia 20×18, `shape-rendering: crispEdges`.
- **Barra a gradini**: all'inizio Settimana, Profilo e Classifica; Mercato alla prima finestra
  invernale (o se svincolato, con un'offerta, dopo la prima stagione); Carriera dopo la prima
  stagione. Regole in `core/unlocks.ts`; una voce vista non sparisce più. Ogni voce nuova ha la
  stella e un riquadro di carta "Novità" sopra la barra, mostrato una volta e chiuso al tocco.

## Spazi, forme, movimento

- Spazi a passi di 4 px (`--o-space-1` … `--o-space-6`); margine laterale 16 px.
- Raggi: 6 (carta), 12, 14 (card), 16 px (pulsanti grandi).
- Area di tocco minima 44 px; pulsanti principali alti 56 px; colonna massima 480 px.
- Animazioni 150–300 ms (`--o-fast`, `--o-normal`, `--o-slow`); ingresso a cascata `.o-enter`.
  Con "riduci movimento" del sistema le animazioni sono disattivate.

## Componenti

| Classe / componente                                                    | Uso                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `.o-wrap`                                                              | Colonna centrale della pagina                                            |
| `.o-card`, `.o-card--hero`                                             | Riquadri; `--hero` con sfumatura verde (prossima partita, punteggio)     |
| `.o-paper`, `.o-masthead`, `.o-kicker`, `.o-headline`, `.o-standfirst` | Pagina di giornale                                                       |
| `.o-btn` (+ `--ghost`, `--small`, `--danger`)                          | Pulsanti                                                                 |
| `.o-choice` (`aria-pressed`)                                           | Scelte: azioni della settimana, risposte, opzioni dei momenti            |
| `.o-bar`, `<app-stat-bar>`                                             | Barre 0–100 con tono automatico                                          |
| `.o-chip`                                                              | Etichette e filtri                                                       |
| `.o-stats`, `.o-stat`                                                  | Griglie di numeri                                                        |
| `.o-lines`, `.o-line`                                                  | Righe di tabellini e riepiloghi                                          |
| `<app-crest>`                                                          | Stemma pixel dal motore (`Club.crest`): forma, colori, simbolo, iniziali |
| `<app-kit>`                                                            | Maglia pixel (`Club.kit`): tinta unita, strisce, banda                   |
| `<app-avatar>`                                                         | Avatar "figurina" a mezzo busto (`Player.appearance` + maglia del club)  |
| `<app-tab-bar>`                                                        | Navigazione in basso a gradini, icone pixel, annuncio "Novità"           |
| `<app-tip>`                                                            | Nota del caporedattore della settimana guidata                           |
| `<app-vignette>`                                                       | Vignetta piatta di un bene o di un'attività (id del catalogo)            |
| `<app-price-chart>`                                                    | Andamento di un prezzo: una linea, area leggera, punto finale, tocco     |
| `<app-portrait>`                                                       | Ritratto tondo di partner o persona conosciuta (testa, spalle, capelli)  |

Interfaccia ibrida (ondata 2):

- **Settimana come plancia**: la scheda partita sta in cima (stemmi 48 px, "VS" in `.o-num`); nella
  settimana della partita ha le chip Completa/Simulata (44 px) e il pulsante "Gioca". Con la
  partita da giocare il pulsante in fondo sparisce: un'azione, un pulsante. Condizione su una riga
  con icone pixel 24 px; notizie come striscia di prima pagina (testata, doppia riga, ombra 4 px).
- **Momento chiave**: opzione con nome, percentuale in `.o-num` a destra colorata per tono, barra a
  10 tacche, riga "Se va: … · Se no: …".
- **Pagella**: voto in un badge `.o-num` con cornice oro; sotto, uno scontrino (`<dl>`) con una riga
  per voce (base, contributi firmati, arrotondamento) e il totale.
- **Notizia come prima pagina**: titolo 40–46 px, scelte `.o-choice.o-px--paper` con la lettera in
  rosso; l'esito è un ritaglio di carta ruotato di 1° con occhiello "Edizione successiva", la
  scelta come titolo e gli effetti uno per riga, valore firmato in `.o-num` 24 px
  (`--o-ink-pos`/`--o-ink-neg`).

Correzioni dell'editor ("Redazione"): il nome originale resta sopra quello nuovo, piccolo e barrato
con una riga rossa (`--o-headline-red`), più il segno ✎ a destra della riga; i colori si scelgono
da cerchi della tavolozza (44 px di area tattile), il motivo da miniature della maglia.

Settimana guidata: ogni nota è un foglio di carta (`--o-paper`, `--o-ink`) appuntato con una
graffetta, leggermente ruotato, con il filo rosso (`--o-headline-red`) a sinistra e l'occhiello
"Nota del caporedattore · n di 10". Una sola nota per schermata; "Capito" a destra, "Salta la guida"
come link. Le scelte di difficoltà mostrano tre tacche crescenti; gli interruttori sì/no usano un
cursore giallo (`--o-accent`) dentro una `.o-choice`.

Vignette (M15): scene 160×96 in colori fissi da illustrazione (cielo `#BFD9DE`, prato, mare o
strada), oggetti piatti senza contorni con un dettaglio d'accento; sempre accanto al nome, mai da
sole. Grafico dei prezzi: una sola serie in `--o-accent`, nessun asse, riferimento tratteggiato
(prezzo medio di acquisto o primo valore), variazione scritta con segno oltre che colorata.

Vita privata (M16): la scheda di chi c'è nel cuore è un foglio di giornale (`.o-paper`) da cronaca
rosa: occhiello rosso con la fase ("Insieme", "Fidanzati", "Sposati"), ritratto tondo con doppio
bordo carta, nome in `o-headline`, mestiere in corsivo. L'intesa è una barra con gradiente da
corallo a rosso (`#D9775F` → `#C2304A`) e una tacca bianca alla soglia di crisi; accanto, il
giudizio a parole con un cuore. I pulsanti sopra la carta sono a pillola con bordo
`--o-paper-rule`, mai i pulsanti scuri dell'app. Azioni della settimana: vignetta a sinistra
(104 px), nome, descrizione, prezzo e pulsante stretto a destra; le azioni bloccate restano visibili
in grigio con il motivo in corsivo, quelle fuori luogo per la situazione non si mostrano. Vignette
nuove: notte di città (incontri, proposta), stanza calda (appuntamento, cena, regalo, figlio),
spiaggia (vacanza), arco di fiori (matrimonio), parco (figli).

Media (M17): il social è un feed a bolle (`.o-card` con angolo in basso stretto: a sinistra i
tifosi, a destra con bordo `--o-accent` i propri post), nome utente in `--o-accent-fg`, cuore e
numero dei "mi piace" in rosa; i titoli di giornale nel feed sono strisce di carta (`.o-paper`) con
il titolo in `--o-font-display`. I post si scelgono da una griglia 2×2 con icona, nome e
descrizione. Intervista e conferenza stampa usano la carta: domanda tra virgolette in
`o-headline`, risposte con il tono in maiuscoletto rosso (`--o-headline-red`); "Nessun commento" è
un link sottolineato. La conferenza ha una fila di cinque microfoni (quello centrale in giallo) e
una domanda alla volta.

Scheda del piano (settimana leggibile): testata `PIANO · CAPITOLO` in `--o-font-display` con
settimane e partite sotto, filetto doppio. Due binari con titolo a quadratino giallo e filetto:
"In campo" (tre chip di carico `.o-choice` in griglia 3×1, alti 64 px, con "+N a sett. · tetto N"
letti dalla configurazione) e "Fuori dal campo" (chip `.o-chip`, "Nessuna" in fondo; un'azione non
disponibile resta visibile, spenta, con il motivo in corsivo sotto). Lettura a tabellone
(`.readout`, fondo `--o-bg-deep`): freschezza attesa in numero pixel grande con barra a dieci
tacche, zona oltre il tetto tratteggiata, tacca bianca al tetto e triangolino sul valore di
adesso; rischio infortuni a parola colorata (basso verde, medio giallo, alto rosso) più la
percentuale; abilità in focus con barra verso il prossimo +1. I numeri che cambiano si riaccendono
in 200 ms (fermi con "riduci movimento"); una regione `aria-live` legge carico, freschezza e
rischio a ogni scelta. Allo stop le settimane in cui l'azione è saltata compaiono in rosso
inchiostro sopra il pulsante di chiusura della prima pagina.

"Dal piano" (risultato del piano): nella scheda capitolo della home, sotto la riga del piano, le
voci mosse dall'ultimo stop in fila separate da `·` ("Tiro 61 → 62 · freschezza 74 → 66 · morale
protetto 2 volte"). A fine capitolo (e a fine stagione) lo stesso elenco va sulla prima pagina,
sotto i voti: titolo in maiuscoletto rosso, righe in `--o-font-display` 18 px, abilità salite in
`--o-ink-pos`, poi un suggerimento neutro in corsivo ("Sei arrivato stanco a 3 partite su 9",
soglia `match.selection.freshnessFrom`). Unico juice: il distintivo `+1` (pixel, fondo oro) accanto
all'abilità salita fa un pop di 300 ms con rimbalzo e la riga si accende d'oro, una volta per stop
e solo nel primo posto in cui il blocco si vede; fermo con "riduci movimento".
Insieme al lampo suona un "ding" ZzFX di circa 0,2 s (`core/sound.ts`), una volta per stop. Il
suono ha il suo interruttore, "Suoni" in Impostazioni (acceso di serie), e non segue "riduci
movimento". L'audio nasce solo alla prima riproduzione, dopo un tocco.

Simboli degli stemmi: `packages/app/src/app/ui/symbols.ts`, uno per ogni id di
`content/data/clubs.json`. Avatar "figurina" (stile scelto dall'utente in M14): mezzo busto vettoriale su fondo `--o-surface`,
ombre morbide (marrone al 16%) sul lato destro del viso, sul collo e sulle braccia, occhi con
bianco, iride e riflesso. Braccia scoperte sotto le maniche della maglia per i tatuaggi (inchiostro
`#22344A` all'82%, rosa e foglia a colori). Parti in `content/data/avatar.json` (colori e id, nuove
voci sempre in fondo) e forme in `ui/avatar-art.ts`. Editor dell'aspetto
(`<app-look-editor>`): gruppi a chip (Corpo, Viso, Capelli, Accessori, Tatuaggi), frecce per le
parti, una zona di tatuaggio alla volta, tatuaggi bloccati elencati con il requisito.

## Testi

Nessun testo visibile nel codice: tutto passa dal pipe `t` con chiavi in
`packages/content/data/i18n/it.ui.json` (prefisso `ui.`). Un test controlla che ogni chiave usata
esista.
