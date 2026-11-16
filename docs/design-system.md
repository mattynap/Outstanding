# Design system

Unica fonte di verità per stile, colori, tipografia, spaziature e componenti dell'app.
Verrà definito nel dettaglio nella milestone M9; qui la direzione concordata.

## Direzione visiva

- "Giornale sportivo italiano incontra app moderna": pagelle come badge numerici grandi, titoli in
  stile prima pagina, messaggi del procuratore come chat, eventi come notizie.
- Modalità scura predefinita (verde campo profondo), modalità chiara disponibile.
- Font: un condensato per titoli e numeri (Barlow Condensed o Oswald) e un sans-serif per i testi
  (Inter). Solo licenza OFL, inclusi nell'app.
- Colori come variabili CSS / token Ionic in un unico file di tema.
- Icone: Ionicons. Animazioni brevi (150–300 ms).
- Mobile first, 360–430 px, pulsanti grandi, uso con una mano.

## Grafica generata dal codice

- Stemmi SVG: forma (scudo, cerchio, ovale), 2 colori, simbolo, iniziali. Dati generati dal motore
  (`Club.crest`), deterministici dal seme del club.
- Maglie SVG: colori + motivo (tinta unita, strisce verticali, orizzontali, banda) da `Club.kit`.
- Avatar del giocatore componibile (volto, capelli, carnagione, maglia).
