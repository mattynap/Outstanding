# Asset esterni e licenze

Ogni asset esterno (font, suoni, immagini, icone) va registrato qui con fonte e licenza.
Preferire CC0 o OFL. Nessun asset senza licenza chiara.

| Asset            | Tipo  | Fonte                                                           | Licenza                   | Dove si usa                   |
| ---------------- | ----- | --------------------------------------------------------------- | ------------------------- | ----------------------------- |
| Barlow Condensed | Font  | Jeremy Tribby, via pacchetto npm `@fontsource/barlow-condensed` | SIL Open Font License 1.1 | App: titoli, numeri, pulsanti |
| Inter            | Font  | Rasmus Andersson, via pacchetto npm `@fontsource/inter`         | SIL Open Font License 1.1 | App: testi                    |
| Ionicons         | Icone | Ionic, pacchetto npm `ionicons`                                 | MIT                       | App: icone dell'interfaccia   |

I font sono inclusi nell'app al momento della build (solo alfabeto latino), non caricati da CDN.
Stemmi, maglie e avatar sono generati dal codice, come l'icona e la schermata d'avvio dell'app
Android (`packages/app/assets/make-art.mjs`).
