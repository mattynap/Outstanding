# Motore mobile e prima prova animata

## Obiettivo e perimetro

Realizzare lavoro effettivo sul gioco e installare la build sul dispositivo fisico disponibile,
come richiesto dall’utente. Prima integrazione giocabile, non dichiarazione di completamento di M18–M23.

## Scelta tecnica

Conservare il motore TypeScript puro e Angular/Ionic/Capacitor; aggiungere Phaser 4.2.1, stabile
secondo https://phaser.io/download/phaser4, con caricamento differito. Il renderer riceve dati e
visualizza gli esiti; il motore rimane l’unica autorità per probabilità, gol e progressione.
Una migrazione Godot/Unity riscriverebbe il gioco senza vantaggi dimostrati per questa prova.

## Vincoli

- Lavoro su ciro-dev, preservando modifiche iOS precedenti e salvataggi; nessun push.
- Qualità del tocco opzionale: .5 neutra, modificatore massimo ±10 punti, limiti in config.
- Numero come decisione legacy resta supportato e mantiene gli esiti precedenti.
- Nessun tempo reale, browser, fisica o dipendenza grafica nel motore.
- Niente nomi, volti, audio o asset reali; testi italiani nelle traduzioni.
- Scene ridimensionabili, pausa in background, riduci movimento, alternativa testuale.
- La richiesta autorizza questa prima prova animata; durata carriera e roadmap restano aperte.

## Esecuzione

- [x] 1. Motore: test prima della modifica; comando con qualità, compatibilità e limiti.
      File: engine/src/match/match.ts, moments.ts, index.ts; config/data/match.json e schema;
      engine/test/match.test.ts. Simulatore di controllo dopo config.
- [x] 2. Presentazione: campo pixel originale con Phaser differito, esito fedele agli eventi,
      tre scene pop originali e pagina Campo prova accessibile senza sovrascrivere carriere.
      File: app/src/app/scenes/*, ui/game-stage.component.ts, pages/proof.page.ts e match.page.ts;
      routes, start, settings/play-mode, game.service e traduzioni.
- [x] 3. Verifica: test completi, typecheck, content:check, lint mirato e build produzione;
      prova browser mobile/desktop, review indipendente delle modifiche.
- [x] 4. iPhone: sync Capacitor, compilazione firmata, installazione e avvio con devicectl;
      raccogliere prove disponibili e dichiarare i limiti dei controlli sul dispositivo.

## Prove iniziali

239 test in 26 file passano. iPhone 15 fisico disponibile e paired; 46 GiB liberi sul Mac.
Team di firma già presente nel progetto. Nessuna build nativa ancora verificata in questo blocco.

## Risultato

Build firmata installata e aperta su iPhone 15. Prove e limiti effettivi in
`reports/prove-motore-mobile/README.md`. Review: due difetti corretti e riesaminati;
controllo visivo: corretto il cambio di scena, poi ripetuto il giro browser completo.
