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
| `<app-avatar>`                                                         | Avatar componibile (`Player.appearance` + maglia del club)              |
| `<app-tab-bar>`                                                        | Navigazione in basso: Settimana, Profilo, Mercato, Classifica, Carriera |

Simboli degli stemmi: `packages/app/src/app/ui/symbols.ts`, uno per ogni id di
`content/data/clubs.json`. Parti dell'avatar: `content/data/avatar.json` (colori e id) e tracciati in
`avatar.component.ts`.

## Testi

Nessun testo visibile nel codice: tutto passa dal pipe `t` con chiavi in
`packages/content/data/i18n/it.ui.json` (prefisso `ui.`). Un test controlla che ogni chiave usata
esista.
