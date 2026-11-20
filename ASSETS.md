# Asset esterni e licenze

Ogni asset esterno (font, suoni, immagini, icone) va registrato qui con fonte e licenza.
Preferire CC0 o OFL. Nessun asset senza licenza chiara.

| Asset            | Tipo  | Fonte                                                                              | Licenza                   | Dove si usa                   |
| ---------------- | ----- | ---------------------------------------------------------------------------------- | ------------------------- | ----------------------------- |
| Barlow Condensed | Font  | Jeremy Tribby, via pacchetto npm `@fontsource/barlow-condensed`                    | SIL Open Font License 1.1 | App: titoli, numeri, pulsanti |
| Inter            | Font  | Rasmus Andersson, via pacchetto npm `@fontsource/inter`                            | SIL Open Font License 1.1 | App: testi                    |
| Jersey 15        | Font  | The Soft Type Project (Sarah Cadigan-Fried), pacchetto npm `@fontsource/jersey-15` | SIL Open Font License 1.1 | App: numeri grandi in pixel   |
| Ionicons         | Icone | Ionic, pacchetto npm `ionicons`                                                    | MIT                       | App: icone dell'interfaccia   |

I font sono inclusi nell'app al momento della build (solo alfabeto latino), non caricati da CDN.
Stemmi, maglie e avatar sono generati dal codice, come l'icona e la schermata d'avvio dell'app
Android (`packages/app/assets/make-art.mjs`).

## Prima integrazione animata

Campo, folla, personaggi, palla e oggetti di scena sono disegnati proceduralmente in
`packages/app/src/app/scenes/create-stage.ts`. Nessun filmato, sprite, volto o suono esterno.
Il renderer usa `phaser@4.2.1` (MIT, licenza inclusa nel pacchetto npm;
fonte: https://github.com/phaserjs/phaser). Il codice di libreria è separato dagli asset originali.

## Suoni

Libreria ZzFX 1.4.0 (Frank Force, MIT; fonte: https://github.com/KilledByAPixel/ZzFX), copiata
in `packages/app/src/app/core/vendor/zzfx.ts` con l'intestazione di licenza originale (l'app
non la importa da npm). Genera gli effetti sonori da parametri numerici nel codice: nessun file
audio esterno. Oggi suona solo il +1 di un'abilità; si spegne con "Suoni" nelle impostazioni.
