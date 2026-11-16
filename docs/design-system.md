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

## Spazi, forme, movimento

- Spazi a passi di 4 px (`--o-space-1` … `--o-space-6`); margine laterale 16 px.
- Raggi: 6 (carta), 12, 14 (card), 16 px (pulsanti grandi).
- Area di tocco minima 44 px; pulsanti principali alti 56 px; colonna massima 480 px.
- Animazioni 150–300 ms (`--o-fast`, `--o-normal`, `--o-slow`); ingresso a cascata `.o-enter`.
  Con "riduci movimento" del sistema le animazioni sono disattivate.

## Componenti

| Classe / componente                                                    | Uso                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `.o-wrap`                                                              | Colonna centrale della pagina                                           |
| `.o-card`, `.o-card--hero`                                             | Riquadri; `--hero` con sfumatura verde (prossima partita, punteggio)    |
| `.o-paper`, `.o-masthead`, `.o-kicker`, `.o-headline`, `.o-standfirst` | Pagina di giornale                                                      |
| `.o-btn` (+ `--ghost`, `--small`, `--danger`)                          | Pulsanti                                                                |
| `.o-choice` (`aria-pressed`)                                           | Scelte: azioni della settimana, risposte, opzioni dei momenti           |
| `.o-bar`, `<app-stat-bar>`                                             | Barre 0–100 con tono automatico                                         |
| `.o-chip`                                                              | Etichette e filtri                                                      |
| `.o-stats`, `.o-stat`                                                  | Griglie di numeri                                                       |
| `.o-lines`, `.o-line`                                                  | Righe di tabellini e riepiloghi                                         |
| `<app-crest>`                                                          | Stemma SVG dal motore (`Club.crest`): forma, colori, simbolo, iniziali  |
| `<app-kit>`                                                            | Maglia SVG (`Club.kit`): tinta unita, strisce, banda                    |
| `<app-avatar>`                                                         | Avatar "figurina" a mezzo busto (`Player.appearance` + maglia del club) |
| `<app-tab-bar>`                                                        | Navigazione in basso: Settimana, Profilo, Mercato, Classifica, Carriera |
| `<app-tip>`                                                            | Nota del caporedattore della settimana guidata                          |
| `<app-vignette>`                                                       | Vignetta piatta di un bene o di un'attività (id del catalogo)           |
| `<app-price-chart>`                                                    | Andamento di un prezzo: una linea, area leggera, punto finale, tocco    |
| `<app-portrait>`                                                       | Ritratto tondo di partner o persona conosciuta (testa, spalle, capelli) |

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
