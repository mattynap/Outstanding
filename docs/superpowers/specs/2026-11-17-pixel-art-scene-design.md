# Scene animate in pixel art — design

Data: 2026-11-17. Stato: approvato dall'utente dopo la prova su iPhone.

## Perché
La prima versione delle scene Phaser (rettangoli e figure piatte) è stata giudicata "orrenda, molto
scarna". L'utente ha chiesto uno stile alla Vampire Survivors: pixel art curata con animazioni vere.
La prova sul campo è stata approvata ("molto meglio"), poi estesa alla sala stampa ("mi piace, molto
molto meglio").

## Obiettivi e limiti
- Tutta la grafica disegnata dal codice pixel per pixel su texture canvas: nessun asset esterno.
- Il motore decide l'esito, Phaser lo mostra. Nessun cambio alle API del motore.
- Movimento ridotto: solo il fotogramma finale, senza particelle, scosse o loop.
- Nessun volto, stemma o marchio reale; i personaggi pop sono generici e i nomi restano storpiati.

## Approcci considerati
1. **Pixel art generata dal codice (scelto):** coerente con stemmi e avatar procedurali, zero licenze,
   colori del club applicati a runtime.
2. Sprite sheet disegnati a mano o presi da pacchetti CC0: qualità più alta ma serve un illustratore
   o licenze, e i colori del club vanno ricolorati.
3. Migliorare le forme vettoriali esistenti: non risolve il problema di stile.

## Struttura
- `scenes/pixel-art.ts`: griglia `Pix` con contorno, palette, giocatori a 16×22 con animazioni,
  stadio, glifi per le scritte.
- `scenes/pixel-people.ts`: mezzobusti frontali 36×44 con 11 espressioni (parla, campanella,
  stupore, telefono, sbadiglio, dubbio, urlo, pugni sul tavolo...).
- `scenes/director.ts`: strumenti di regia comuni (tempi, tween, fermo immagine, scritta a nastro,
  impatto con lampo, scossa e zoom).
- `scenes/pixel-pitch.ts`: campo a zoom 2 (mondo 240×144), coreografie di attacco, difesa e porta.
- `scenes/pixel-press.ts`: inquadrature strette a zoom 3 (mondo 160×96): spogliatoio con
  campanella, studio TV con pendolino, conferenza stampa.
- `scenes/create-stage.ts`: sceglie campo o sala, distrugge gli oggetti e ripristina la camera
  tra una scena e l'altra.

## Lasciato aperto
- Pubblico della tribuna poco leggibile da vicino.
- Le scene pop sono prove visive: i 47 momenti di cultura pop non sono ancora collegati alla carriera.
- Aggiornare CLAUDE.md §10 (direzione visiva pixel) su decisione dell'utente.
