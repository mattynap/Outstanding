# Prima prova animata di Outstanding su mobile

Data: 2026-11-17. Branch: `ciro-dev`. Questa è una prima integrazione giocabile,
non il completamento di M18–M23 e non una migrazione di tutto il gioco a un altro runtime.

## Cosa è stato realizzato

- Phaser 4.2.1 caricato quando serve, dentro Angular/Ionic/Capacitor; campo, giocatori,
  oggetti e tre scene originali disegnati dal codice, senza download di asset durante il gioco.
- Motore TypeScript ancora autorevole. Comando `{ optionIndex, quality }`, qualità finita fra
  0 e 1; 0,5 neutra. Bonus massimo configurabile ±10 punti percentuali, entro i limiti esistenti.
  La decisione numerica precedente rimane compatibile e mantiene gli stessi esiti.
- Partite della carriera con alternativa testuale e tempismo facoltativo; scena di esito prima
  del momento successivo. Nessun conto alla rovescia che obblighi a scegliere.
- Pagina «Campo prova» raggiungibile dall’avvio: partita isolata per quattro ruoli e scene
  campanella, pendolino e conferenza. Le scene pop sono prove visive; non sono 47 eventi già integrati.
- La prova non usa gli slot. La partita dimostrativa usa un seme fisso e abilità impostate a 80
  per rendere accessibili i momenti dei quattro ruoli; non modifica il bilanciamento della carriera.
- Pausa delle scene in background e all’uscita della pagina; movimento ridotto con qualità neutra;
  distruzione del renderer quando la pagina viene rimossa; disegni statici se il caricamento fallisce.

## Prove eseguite e relativi limiti

| Verifica                                       | Risultato                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Vitest completo                                | 269 test passati in 27 file, contro i 239 iniziali                                                                                   |
| Typecheck di tutti i pacchetti                 | Passato                                                                                                                              |
| `content:check`                                | Contenuti validi                                                                                                                     |
| ESLint                                         | Passato; il comando lint generale arriva a Prettier                                                                                  |
| Formattazione dei file di questa modifica      | Passata                                                                                                                              |
| Lint generale                                  | Restano avvisi Prettier in 18 documenti preesistenti: `.ai/`, design meccaniche e vecchie ricerche. Non riformattati fuori perimetro |
| Simulatore, 50 carriere per strategia, seed 42 | Cautious e aggressive: output JSON prima/dopo esattamente identici con qualità neutra                                                |
| Browser mobile 390×844                         | Campo e tre scene realmente selezionati; animazione verificata fra fotogrammi; nessun overflow                                       |
| Browser desktop 1440×1000                      | Schermata verificata e screenshot salvato                                                                                            |
| Quattro partite complete offline               | GK 2, DEF 4, MID 4, ATT 1 momenti, con comandi reali del motore                                                                      |
| Movimento ridotto e ritorno al menu            | Scena ferma e qualità neutra; ritorno e riapertura senza renderer duplicati                                                          |
| Errori JavaScript nel giro browser             | Nessuno                                                                                                                              |
| Build iOS Debug firmata                        | `BUILD SUCCEEDED` per dispositivo fisico                                                                                             |
| Installazione sul dispositivo                  | Riuscita, bundle `it.outstanding.calcio`, senza disinstallazione                                                                     |
| Avvio su iPhone 15                             | Riuscito; screenshot acquisito mentre sono visibili campo e barra di precisione                                                      |
| FPS sul dispositivo                            | Contatore Phaser a 61 nello screenshot: lettura istantanea, circa 60, non benchmark di frame time o consumi                          |
| Registrazione nativa                           | Tentata; devicectl risponde che Screen Recording non è supportato dal dispositivo. Nessun video dichiarato disponibile               |

L’aggiornamento usa lo stesso bundle e non prevede migrazione dei salvataggi. Non è stata effettuata
una verifica fisica completa di ogni carriera preesistente, dell’import/export o di tutti gli
scenari della partita normale. Il giro automatico completo riguarda il Campo prova e il motore.
Non sono misurati autonomia, surriscaldamento o compatibilità di altri modelli Android/iPhone.

Il primo controllo visivo ha rilevato un collegamento Angular che non aggiornava la scena dopo
il cambio scheda. Corretto leggendo sempre il signal prima di chiamare il controller; le prove
successive verificano anche la scena effettivamente selezionata nel renderer, oltre ai fotogrammi.
La review ha inoltre fatto correggere l’identificazione dell’ultimo evento dopo il riordino del
report e il feedback dei passaggi del portiere/piazzati offensivi. Nessun rilievo rimasto aperto
nelle correzioni riesaminate.

## File di prova

- [Campo su iPhone fisico](iphone-campo.png).
- [Campo nel browser mobile](campo-mobile.png) e [desktop](campo-desktop.png).
- [Campanella](campanella-mobile.png), [pendolino](pendolino-mobile.png), [conferenza](conferenza-mobile.png).
- [Esiti del giro browser](verifica-browser.json).

I file browser non sono spacciati per screenshot del telefono. Il file iPhone proviene da
`devicectl device capture screenshot`, acquisito durante l’esecuzione dell’app nativa.

## Ripetere la prova

Aprire Outstanding → «Prova il campo animato». Nella scheda Partita scegliere il ruolo e un’azione;
fermare il cursore oppure scegliere «Senza tempismo», poi «Continua». Le altre tre schede aprono
le scene originali e consentono di rivederle. Tornare al menu per riprendere la carriera.

Comandi di verifica: `pnpm test`, `pnpm typecheck`, `pnpm content:check`, `pnpm lint`,
`pnpm --filter @outstanding/app build`. Per iOS: `cap sync ios` e build del progetto Xcode
sul dispositivo collegato con il Team già configurato. Nessuna pubblicazione sugli store.

## Lavoro ancora aperto

Profili di rischio contestuali e loro bilanciamento, modalità rapida, XP/mosse, album/rivale e
integrazione delle 47 scene nella carriera restano nelle rispettive milestone. La preferenza
per animazioni e questa installazione non risolvono durata carriera o ordine M18–M23/M12.
