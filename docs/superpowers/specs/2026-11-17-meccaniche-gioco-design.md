# Outstanding da simulatore a gioco: design delle nuove meccaniche

Data: 2026-11-17 · Stato: bozza da approvare · Fonti: conversazione con l'utente, report
`reports/Monetizzazione e retention gioco calcio.md`, codice attuale (M0–M17 fatte).

## 1. Perché

Oggi Outstanding è un simulatore testuale completo ma passivo: si leggono notizie, si sceglie, si va
avanti veloce. L'utente vuole un **gioco**, con più interazioni possibili, ispirato nello spirito (non
nell'aspetto né nei dati) a Pocket Scout FC. Cosa gli piace: **vedere crescere**, **partite rapide**,
**collezionare**. Il traguardo dichiarato: diventare il giocatore **più forte e più ricco del mondo**.

Difetti misurati che il design deve correggere:
- nei momenti chiave tutte le opzioni rendono uguale in media, quindi la strategia prudente domina
  (simulatore M8: aggressiva voto 5,75 contro 6,23 della prudente);
- l'avanti veloce rende il giocatore spettatore;
- mancano obiettivi a breve termine;
- i sistemi (campo, soldi, vita privata) non si parlano.

## 2. Obiettivi, non obiettivi, anti-obiettivi

**Obiettivi**
- Ogni sessione (5–15 minuti, circa una settimana di gioco) dà almeno: una decisione in campo che
  conta, un progresso visibile (punti, grado, figurina, incasso) e un motivo per tornare.
- Cinque meccaniche collegate: partita interattiva, punti abilità e mosse, gradi e obiettivi,
  album e rivale, business idle.
- Modello di guadagno pulito: prima carriera gratuita, sblocco unico, video a premio facoltativi.

**Non obiettivi (ora)**
- Grafica 2D animata della fase 2 (resta soggetta ad approvazione esplicita).
- Server, account, classifiche online: tutto resta offline.
- Pubblicità e acquisti reali: in questa fase solo le interfacce finte già previste in M11.

**Anti-obiettivi (se succede, è un fallimento anche se funziona)**
- Pagare fa vincere: punti, mosse, allenamento, accelerazioni del business in vendita.
- Casualità a pagamento: bustine di figurine, casse, valuta per comprarle.
- Abitudine punitiva: streak che si azzera e colpevolizza, rivale che "ti ruba" progressi se non giochi.
- Il minigioco diventa obbligatorio per riuscire: chi non ha riflessi deve poter giocare bene.
- Una scelta sempre giusta nei momenti chiave.

## 3. Vincoli

- Motore puro e deterministico (CLAUDE.md §5): nessun `Date.now()` nel motore. Tutto ciò che viene
  dal mondo reale (esito del minigioco, ore trascorse, video visto) entra come **dato di un comando**.
- Nessun numero magico: ogni parametro nuovo in `packages/config/data/*.json` con schema Zod.
- Contenuti come dati: mosse, obiettivi, figurine, gradi in `packages/content/`.
- Ogni cambio di `GameState` porta `saveVersion` + migrazione e test.
- Ogni modifica a `config/` va confrontata con il simulatore.
- PEGI 12 secondo le regole 2026: niente oggetti casuali a pagamento (PEGI 16), niente offerte a
  tempo, niente meccaniche che puniscono l'assenza. Pubblico dichiarato 13+ sugli store.
- Nomi storpiati o inventati per club, giocatori e competizioni (naming-policy).

## 4. Approcci considerati

| Approccio | Pro | Contro |
|---|---|---|
| **A. Una meccanica alla volta, completa** (motore + config + contenuti + schermata + simulatore) | A ogni passo c'è qualcosa da provare sull'iPhone; ogni pezzo poggia su uno collaudato | La grafica pixel arriva sopra schermate già fatte (da ridisegnare) |
| B. Prima tutto il motore, poi tutte le schermate | Architettura più pulita | Settimane senza niente da provare; si scopre tardi se diverte |
| C. Prototipo usa e getta di partita + punti + obiettivi | Il modo più veloce di sentire il giro | Lavoro fatto due volte |

**Scelto: A** (proposta mia, l'utente ha chiesto di procedere col documento). Le schermate nuove usano
il design system attuale; quando l'utente sceglie la direzione pixel (tavola A/B/C) si ridisegnano.

## 5. Il giro di una sessione

```
Settimana N
 1. Piano           spendi punti abilità, equipaggi mosse, gestisci il business
 2. Notizie         0–2 eventi (esistenti) + eventuale messaggio del rivale
 3. Partita         modalità completa o rapida, momenti chiave con minigioco facoltativo
 4. Pagella         voto, XP, obiettivi completati, figurine ottenute, [video: raddoppia bonus]
 5. Fine settimana  incasso del business, confronto col rivale, avanzamento grado
```

Fuori dal tempo di gioco, nel tempo reale (strato giornaliero, §11): sfida del giorno, cassa del
business accumulata mentre si era via, streak gentile.

## 6. Meccanica 1: partita interattiva

### 6.1 Momenti chiave con rischio vero
Oggi ogni opzione ha `difficulty`, `success.rating`, `failure.rating`, `goalAgainst`. Si cambia la
regola, non la struttura:
- ogni opzione ha un **profilo**: `sicura` (probabilità alta, guadagno piccolo), `bilanciata`,
  `rischiosa` (probabilità bassa, guadagno grande: gol, assist decisivo, voto +1);
- il **contesto** cambia il valore: punteggio, minuto, forza dell'avversario, fiducia dell'allenatore.
  Esempio: sotto di un gol all'85' la `rischiosa` vale di più (il gol pesa doppio sul voto e sul
  risultato), in vantaggio la `sicura` protegge. Così nessuna opzione è sempre giusta;
- la UI mostra percentuale e conseguenza in una riga (come nella tavola: "Passaggio 68, assist").

Criterio di accettazione (simulatore): una strategia "contestuale" deve battere sia la prudente sia
l'aggressiva; la differenza di voto medio fra prudente e aggressiva deve stare entro ±0,2.

### 6.2 Minigioco a tempo (facoltativo)
Dopo la scelta dell'opzione parte un minigioco di 1–2 secondi che produce una **qualità** `q` tra 0 e 1.
Proposta: barra di precisione (un cursore scorre, si tocca quando è nella zona; la zona è più larga se
l'abilità è alta). `q` sposta la probabilità di successo di al massimo ±10 punti percentuali.
- Si può disattivare dalle impostazioni: allora `q = 0,5` (nessun effetto). Il gioco resta vincibile.
- Nel motore: `decide` restituisce `{ optionIndex, quality }`; il simulatore estrae `quality` da una
  distribuzione per strategia (es. media 0,5).

### 6.3 Mini-campo e modalità
- **Completa**: cronaca dei 6 blocchi con il mini-campo (giocatori piccoli in pixel visti dall'alto,
  come nella tavola di stile), 3–6 momenti.
- **Rapida**: 1–2 momenti solo nelle fasi decisive, poi risultato e pagella. Obiettivo: sotto 1 minuto.
- **Simula**: come oggi, nessun momento.
- La scelta è per partita, con un predefinito nelle impostazioni. Serve anche a riportare il tempo
  di una carriera verso le 2–4 ore (oggi ~6–7 h giocando tutte le partite).

## 7. Meccanica 2: punti abilità e mosse

- **XP** da: minuti giocati, voto, momenti riusciti, obiettivi. Livello del giocatore 1–50 con curva
  in config. Ogni livello dà **punti abilità**.
- I punti si spendono sulle abilità (+1 per punto, costo che sale con il valore). Restano il
  potenziale nascosto come tetto morbido e l'allenamento settimanale di M6: i punti sono la parte
  che il giocatore controlla, l'allenamento la parte di routine.
- **Mosse**: 6–8 per ruolo, in `content/data/moves/`. Ogni mossa ha requisiti (livello, abilità
  minima) e un costo in punti. Effetto: aggiunge una **nuova opzione** a un tipo di momento (es.
  ATT "Tiro a giro" in `att_box_chance`, GK "Parata in tuffo") oppure un modificatore piccolo.
- Si equipaggiano **massimo 3 mosse** (scelta di stile, non accumulo).
- Mai in vendita, mai ottenibili con video.

## 8. Meccanica 3: gradi e obiettivi

- **Gradi** (6): Promessa, Titolare, Protagonista, Campione, Fuoriclasse, Leggenda. Si sale con il
  punteggio di carriera che il simulatore calcola già (M8), reso visibile. Ogni grado sblocca qualcosa
  (sezione dell'album, slot mossa, attività del business).
- **Obiettivi della settimana** (tempo di gioco): 3 per settimana, generati dal contesto ("Voto almeno
  7", "Un assist", "Vinci il derby"). Premio: XP e soldi. Non si accumulano penalità se falliti.
- **Obiettivi della stagione**: 3 scelti a inizio stagione con il procuratore (gol, presenze,
  promozione). Premio maggiore + figurina speciale.
- **Traguardi di carriera**: permanenti (primo gol in massima serie, 100 presenze...), alimentano
  l'album.

## 9. Meccanica 4: album di figurine e rivale

### 9.1 Album
- Sezioni: club in cui hai giocato, compagni, avversari celebri (nomi storpiati), i tuoi momenti
  (prime pagine, pagelle da 9+), trofei, il rivale.
- Le figurine si ottengono **solo giocando**: traguardi, obiettivi, eventi, e una probabilità per
  partita (estratta con `Rng`) legata all'avversario affrontato.
- I **doppioni** diventano "crediti album" per **scegliere** una figurina mancante (scelta, non
  casuale). I crediti non si comprano.
- Obiettivo di bilanciamento: una carriera completa riempie il 60–80% dell'album; completarlo
  richiede più carriere (valore dello sblocco completo).
- Ogni figurina è disegnata dal codice (sprite pixel + cornice), condivisibile come immagine.

### 9.2 Rivale
- Generato all'inizio della carriera: stessa età, stesso ruolo, città vicina, potenziale simile.
- Ha una carriera simulata con le stesse regole leggere degli altri giocatori del mondo (club,
  trasferimenti, gol, voto medio), aggiornata a fine settimana.
- Confronto settimanale visibile (chi ha fatto meglio) e stagionale.
- **Scontro diretto** quando i due club si incontrano: momento chiave speciale, notizia dedicata.
- Eventi di rivalità (dichiarazioni, stesso club che vi vuole entrambi, possibile diventare compagni).
- Il rivale non fa perdere nulla: è uno specchio, non una minaccia.

## 10. Meccanica 5: business idle e "più ricco del mondo"

Si parte dalle attività di M15 (`finance.businesses`: bar, scuola calcio, ristorante, palestra,
marchio..., massimo 3, salute e rendita settimanale) e si aggiunge la crescita:
- **Livelli 1–10** per attività, migliorati con i soldi; ogni livello alza la rendita. Più avanti:
  **direttore** (riduce il rischio di chiusura) e **filiali** in altre città.
- La rendita resta **settimanale nel tempo di gioco** (motore deterministico).
- **Cassa mentre sei via** (tempo reale): la app calcola le ore trascorse dall'ultima sessione,
  con tetto di 8 ore, e invia al motore il comando `collectIdle(hours)`. Il motore converte le ore in
  un incasso piccolo rispetto a quello settimanale (bonus di rientro, non motore di progresso).
  Video facoltativo: raddoppia la cassa, massimo 1–2 al giorno.
- I soldi **non comprano prestazioni in campo** (niente abilità, niente punti). Comprano beni, status,
  felicità, sicurezza a fine carriera: il ponte con campo è solo indiretto (felicità e morale, già
  esistenti).
- **Due classifiche** inventate, aggiornate a fine stagione: il pallone d'oro storpiato (forza) e la
  lista dei più ricchi del calcio (patrimonio). Il traguardo "più forte e più ricco del mondo" è
  arrivare primo in entrambe.

## 11. Strato giornaliero (tempo reale, offline)

- **Sfida del giorno**: una al giorno reale, piccola (es. "gioca un momento con il minigioco"),
  premio: XP o crediti album.
- **Streak gentile**: conta i giorni con almeno una sessione; premi a soglie (3, 7, 30 giorni);
  saltare un giorno usa una **protezione** guadagnata giocando (massimo 2); senza protezioni lo streak
  riparte ma i premi già presi restano. Nessun testo che colpevolizza.
- **Notifiche locali**: chieste dopo la prima partita, massimo 1 al giorno, testi neutri ("La cassa
  del ristorante è piena", "È arrivata la sfida del giorno"), disattivabili.
- **Orologio**: si salva l'ora massima vista; se l'orologio torna indietro non si danno premi a tempo
  fino a quando non lo supera di nuovo. Correzioni piccole (ora legale) tollerate. Il tempo reale
  sblocca solo cose piccole, quindi barare non conviene.
- Lo stato dello strato giornaliero sta nel salvataggio, ma i dati del tempo reale entrano solo via
  comandi.

## 12. Modello di guadagno

- **Gratis**: la prima carriera fino alla fine della seconda stagione, con tutte le meccaniche.
- **Sblocco completo** unico, 4,99 € (da provare 6,99 € nel lancio di prova): carriere illimitate,
  oltre la seconda stagione, editor, più slot di salvataggio, nessuna pubblicità.
- **Video a premio** solo nella versione gratuita, facoltativi, massimo 4–6 al giorno in totale:
  raddoppio del bonus di popolarità/follower dopo la pagella (1 a partita), raddoppio della cassa del
  business (1–2 al giorno), crediti album extra (1 al giorno). Mai durante la partita, mai per punti
  o mosse, mai per protezioni dello streak.
- **Interstitial e banner**: spenti al lancio.
- **Più avanti**: 3–4 pacchetti cosmetici a prezzo fisso (avatar, tatuaggi, lusso, cornici album).
- Tecnica: si usano le interfacce di M11 (finte). Il premio entra nel motore come comando esplicito
  `grantReward(kind)`; limiti di frequenza in config. Se il video non è caricato (offline) il pulsante
  non compare. L'integrazione reale (AdMob, acquisti, consenso UMP, schermata dell'età) è una
  milestone a parte, dopo il lancio di prova.

## 13. Ordine di lavoro (milestone)

| Milestone | Contenuto | Fatta quando |
|---|---|---|
| **M18 Partita interattiva** | profili di rischio e contesto, minigioco, modalità rapida, mini-campo | criterio §6.1 nel simulatore, tempo partita rapida < 1 min |
| **M19 Punti e mosse** | XP, livelli, punti, mosse per ruolo, equipaggiamento | curva di livello tarata, nessuna mossa dominante nel simulatore |
| **M20 Gradi e obiettivi** | gradi, obiettivi settimana/stagione, traguardi, strato giornaliero | % obiettivi completati 40–70% nel simulatore |
| **M21 Album e rivale** | album, figurine, doppioni, rivale e scontri diretti | album 60–80% per carriera completa |
| **M22 Business e classifiche** | livelli, cassa mentre sei via, due classifiche | patrimonio medio e % primi in classifica tarati |
| **M23 Guadagno** | blocco dopo la seconda stagione, video a premio con limiti, sblocco (finti) | flusso completo provato in app |

Ogni milestone: motore + config + contenuti + schermata + simulatore + migrazione dei salvataggi +
CHANGELOG + memoria. Il simulatore riceve le metriche nuove (livello medio, mosse usate, obiettivi
completati, figurine, esito del rivale, patrimonio).

## 14. Lasciato a chi costruisce

Valori numerici (curve XP, costi, probabilità, rendite) da tarare col simulatore; elenco esatto di
mosse, obiettivi, figurine e testi (con la guida di stile); nomi dei gradi alternativi se suonano
male; struttura interna dei nuovi moduli del motore; forma esatta delle schermate nel design system
corrente.

## 15. Decisioni prese da me, da controllare

- Approccio A e ordine M18→M23.
- Minigioco a barra di precisione, effetto massimo ±10 punti, disattivabile.
- Cassa del business in tempo reale con tetto di 8 ore e piccola rispetto alla rendita settimanale.
- Punti abilità in aggiunta all'allenamento di M6, non al posto.
- Massimo 3 mosse equipaggiate.
- Gratis fino a fine seconda stagione della prima carriera, sblocco a 4,99 €.
