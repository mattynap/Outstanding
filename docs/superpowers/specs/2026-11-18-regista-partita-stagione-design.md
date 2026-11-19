# Regista della partita e della stagione: design

Data: 2026-11-18 · Stato: approvato dopo builder check (2026-11-18), decisioni in §8
Fonti: conversazione con l'utente del 2026-11-18, `docs/superpowers/specs/2026-11-17-meccaniche-gioco-design.md` (§6),
codice attuale (`packages/engine/src/match/`, `season/`, `config/data/match.json`, `calendar.json`).

## 1. Perché

L'utente trova il gioco **piatto nella sua interezza**. Sulla partita, con le sue parole:
- l'interazione è poca e monotona, i momenti sono ripetitivi;
- manca la partita che scorre **prima** della scelta: il momento arriva dal nulla;
- le scelte non pesano: "ok ho completato un passaggio, poi?";
- gli eventi sono a caso, senza correlazione: nessuna logica dice perché **proprio ora** serve intervenire;
- il minigioco a barra con i tasti "colpisci" e "salta" è inutile.

Vuole **un algoritmo unico che colga il tempismo** e intrattenga il giocatore.
Sulla stagione: con partite più ricche, 52 settimane e 34–38 giornate giocate una a una rendono la
stagione e la carriera troppo lunghe e ripetitive (oltre 40 ore stimate).

Difetti misurati nel codice:
- momenti a minuti estratti a caso (`planMomentMinutes`), indipendenti fra loro e dal punteggio;
- probabilità senza contesto (`optionChance`: abilità, avversario, difficoltà, condizione, tratti);
- valore atteso delle opzioni pareggiato: la prudente domina (voto 6,23 contro 5,75 dell'aggressiva);
- qualità del tocco: effetto massimo ±10 punti (`qualityMaxBonus`), saltabile a ogni momento.

## 2. Ordine scelto (approccio B)

L'utente ha scelto: **prima rifare il nucleo, poi aggiungere** (alternative scartate: seguire M18–M23
così com'è, costruendo su un nucleo poco chiaro; un unico ridisegno totale, troppo rischioso e lento
da provare). Progetti in ordine, uno alla volta:
1. **Partita** (questo documento, §4).
2. **Stagione e ritmo** (questo documento, §5).
3. Settimana e allenamento leggibili: effetto mostrato prima, risultato visto dopo (da brainstormare).
4. Collegamenti fra sistemi: vita privata, soldi, media ↔ forma e prestazioni (da brainstormare).
5. Poi M19–M23 del documento del 17/11.

## 3. Obiettivi, non obiettivi, anti-obiettivi

**Obiettivi**
- Ogni intervento in partita arriva in un momento che si sente importante, ed è conseguenza di
  quello che si è visto succedere.
- Ogni scelta lascia un segno visibile nel resto della partita.
- Nessuna opzione sempre giusta: la strategia "contestuale" batte prudente e aggressiva nel simulatore.
- Stagione di 20–30 minuti reali, carriera completa di 6–8 ore.

**Non obiettivi**
- Fase 2D completa: Phaser resta il renderer già integrato, il motore decide sempre l'esito.
- Ridurre il realismo del campionato: tutte le giornate e la classifica vera restano.

**Anti-obiettivi**
- Interventi a caso o a cadenza fissa che il giocatore sente come interruzioni.
- Gesto obbligatorio per riuscire: chi lo spegne deve poter giocare bene con la sola scelta.
- Il gesto conta così poco da sembrare inutile (il difetto di oggi).
- Partita completa oltre i 4 minuti o stagioni che tornano a essere 38 partite tutte uguali.

## 4. Progetto 1: partita

### 4.1 Cronaca che scorre
La partita avanza minuto per minuto con righe di cronaca e una **barra della pressione** che si sposta
verso una porta o l'altra (inerzia della partita, calcolata dal motore). Il momento chiave nasce da
quella pressione: prima si vede la propria squadra spingere (o soffrire), poi tocca al giocatore.

### 4.2 Il regista (algoritmo di tensione)
Funzione pura del motore che a ogni minuto calcola un **valore di tensione** da:
- punteggio e minuto (pareggio o svantaggio di un gol nel finale = tensione alta);
- importanza della partita (derby, scontro diretto, coppa, esordio, osservatore in tribuna);
- storia del giocatore (contratto in scadenza, rivale in campo, fiducia del mister bassa);
- pressione attuale (azione pericolosa in corso).
Quando la tensione supera una soglia, e rispettando un intervallo minimo fra interventi, il regista
**ferma la partita e passa la palla**. Lo 0-0 al 10' scorre, il pareggio all'88' ferma.
Il budget di interventi e il "finale caldo" (2–3 interventi dopo il 75' se il risultato è in bilico)
sono parametri in `config/match.json`. Determinismo: tutto con `Rng` nello stato.

### 4.3 Azioni con seguito (catene)
Un momento può essere una piccola catena di 1–3 passi: passaggio riuscito → il compagno crossa →
colpo di testa o sponda. Un errore apre il contropiede avversario e può chiedere un recupero.
Le catene sono dati (`content` o `config`), non codice.

### 4.4 Conseguenze nel resto della partita
Ogni esito sposta stati della partita: fiducia del mister, nervosismo, stanchezza, marcatura
avversaria (raddoppio dopo un dribbling riuscito), inerzia. Questi stati entrano nelle probabilità
dei momenti successivi e nella cronaca.

### 4.5 Rischio vero (dal documento del 17/11, §6.1)
Profili `sicura` / `bilanciata` / `rischiosa`; il contesto cambia il valore (sotto di un gol all'85' il
rischio vale di più, in vantaggio la sicura protegge). Criterio: strategia contestuale migliore di
entrambe; differenza di voto medio fra prudente e aggressiva entro ±0,2.

### 4.6 Gesti al posto della barra
Via la barra con "colpisci"/"salta". Un gesto per tipo di azione, sullo schermo:
- tiro: tieni premuto per caricare, rilascia nella zona giusta;
- dribbling: 2–3 tocchi a tempo mentre l'avversario si avvicina;
- passaggio: tocca il compagno libero prima che lo spazio si chiuda;
- parata: tocca il lato giusto quando parte il tiro.
Il peso del gesto sale rispetto ai ±10 punti di oggi (valore in config, da tarare). Nessun tasto
"salta" in partita: i gesti si spengono una volta in Impostazioni (valore neutro). Il gesto entra nel
motore come `quality` 0–1, già esistente: salvataggi e simulatore restano compatibili.

### 4.7 Durata
- Partita completa: 3–4 minuti, 5–7 interventi (alcuni in catena).
- Partita rapida: meno di 1 minuto, 1–2 interventi decisivi, il resto simulato.

## 5. Progetto 2: stagione

- La stagione si divide in **capitoli**: preparazione, autunno, inverno + mercato, primavera, finale.
- In ogni capitolo il giocatore gioca **2–3 partite scelte dal regista della stagione**: derby,
  scontri diretti, partite con osservatori, esordio, partite decisive per promozione o salvezza.
- Le altre giornate scorrono in un **riepilogo**: risultati, voti del giocatore, classifica.
- Il campionato resta completo (tutte le giornate, classifica vera, coppe).
- Bersaglio: stagione 20–30 minuti, carriera 6–8 ore, misurato con il simulatore.
- Decisioni su piano, partite extra, modalità e avanti veloce: §8.2.

## 6. Vincoli

- Motore puro e deterministico (CLAUDE.md §5); nessun numero magico, tutto in `config/` con Zod.
- `GameState` cambia: `saveVersion` + migrazione + test.
- Ogni modifica a `config/` con confronto del simulatore (prima/dopo).
- La UI usa il design system ibrido (`docs/design-system.md`) e la skill `frontend-design`.

## 7. Lasciato a chi costruisce (chiuso in §8)

- Formula esatta della tensione e soglie: proposta + taratura col simulatore.
- Formato dati delle catene e degli stati della partita.
- Nuova strategia "contestuale" nel simulatore.
- Builder check di questo documento prima del piano (skill `writing-plans`).

## 8. Decisioni del builder check (2026-11-18)

Builder check fatto da due revisori indipendenti; le divergenze sono state mostrate all'utente, che ha
confermato le scelte sotto.

### 8.1 Partita
- **Stato:** la partita è già riprendibile (`GameState.currentMatch`, `beginMatch`/`decideMoment`/
  `getPendingMoment`). Si estende `MatchState`: `blocksDone` → `minute`, via `momentMinutes`; nuovi
  `mode` (`full`|`quick`|`sim`), `pressure`, `trace` (pressione per minuto, per la barra dopo il
  ricaricamento), `director` (budget, finale caldo, ultimo intervento), `dyn` (fiducia del mister,
  nervosismo, stanchezza, marcatura), `pending.chain`. `playMatch(state, decide)` mantiene la firma.
- **Simulazione:** minuto per minuto; la pressione P ∈ [−1,1] genera i gol (probabilità per minuto
  modulata da P, normalizzata per non spostare la media gol). Sostituisce `simulateBlock`.
- **Tensione:** `T = wGame·close(d)·(b + (1−b)·(t/90)^k) + wStakes·stakes + wPress·max(0,|P|−pDanger)`,
  con `close(d)` tabella in config. Intervento se `T ≥ soglia`, passati `minGap` minuti, con probabilità
  `min(pMax, (T−soglia)·hazard)` estratta con `Rng` (niente cadenza fissa). Tutto in `match.json > director`.
- **Budget:** contato a **passi interattivi** (ogni passo di catena consuma budget; l'intervallo
  minimo vale fra inizi di catena). Il budget è 5–7 in ogni modalità; la rapida ne mostra 1–2 (gli altri si risolvono da soli con `autoDecider`, senza gesti da leggenda), la simulata nessuno. Finale caldo: dopo il 75' con scarto ≤ 1
  si riservano 2–3 passi e `minGap` scende. Vietato aprire una catena che non entra nel budget.
  Garantito 1 intervento se il giocatore resta in campo almeno `minMinutesForMoment`.
- **Catene:** in `config/data/moments.json` (i tipi di momento escono da `match.json`), testi in
  `content`. Esito con `next?: { momentId, chance? }` ed `effects?` sugli stati `dyn` e sulla pressione;
  tipi `chainOnly` (es. `counter_recovery`) e `phase: attack|defense`; opzioni con
  `risk: safe|balanced|risky`. Il gol si risolve una sola volta, a fine catena (niente doppio
  `goalAgainst` + contropiede). Validazione Zod: riferimenti esistenti, nessun ciclo, profondità ≤ 3.
- **Stati `dyn`:** valgono solo nella partita; nella carriera passano tramite voto e seguito della partita.
- **Segnali di importanza:** derby, scontro diretto, coppa, esordio, contratto in scadenza, fiducia del
  mister (esistenti) più due nuovi: **osservatore in tribuna** (segno sulla partita, da evento o
  estrazione) e **rivale in campo** (giocatore avversario dello stesso ruolo legato al giocatore).
- **Gesto:** tetto di `qualityMaxBonus` alzato nello schema; la media della qualità di un giocatore medio
  deve stare a 0,5 per ogni gesto (requisito UI). Il simulatore usa profili di qualità per strategia.
- **Salvataggi:** `saveVersion` 1 → 2; la migrazione converte le partite a metà (`minute = blocksDone·15`,
  o `pending.minute` se c'è un momento in attesa: i gol v1 estratti dopo quel minuto si tolgono e si
  risimulano; P = 0, `dyn` neutro, `pending` conservato). Il budget scende all'apertura di ogni passo.
- **Catene e budget:** una catena si apre solo se la sua profondità massima entra nel budget; i suoi
  passi stanno tutti nel minuto della radice.

### 8.2 Stagione
- **Piano per capitolo:** il giocatore sceglie un piano a inizio capitolo, il motore lo applica a ogni
  settimana; si può cambiare a ogni stop. Il piano ricordato diventa il piano del capitolo.
  Le settimane restano tutte simulate da `advanceWeek` (recupero, finanze, mercato, coppe).
- **Partite giocate:** 2–3 per capitolo scelte dal regista della stagione: la più importante in
  modalità completa, le altre in rapida. Le altre giornate in riepilogo (simulate). Il giocatore
  **non** può chiedere di giocare una partita non scelta.
- **Avanti veloce:** diventa "vai al prossimo stop": scorre fino alla prossima partita scelta, evento
  o offerta; il riepilogo mostra le giornate saltate.
- **Durata:** stagione 20–30 minuti, carriera 6–8 ore (CLAUDE.md §9 aggiornato).

### 8.3 Criterio di bilanciamento (graduale)
- Principale: voto medio in partita a parità di scelte fuori dal campo; la contestuale batte prudente e
  aggressiva, e fra queste due la differenza resta entro ±0,2.
- Guardrail: a ogni passo il simulatore confronta con la baseline età d'esordio, % in massima serie,
  gol e presenze, trofei, % leggende; fuori tolleranza il passo non si chiude.
- Gradualità: i nuovi fattori (pressione, `dyn`, rischio, gesto) entrano a peso ridotto e salgono solo
  se i guardrail reggono. Baseline a 5000 carriere salvata prima di toccare il motore.

### 8.4 Revisione e meccaniche aggiunte (2026-11-18)
Dopo una revisione del piano e una ricerca sulle meccaniche (report
`reports/Meccaniche regista partita e stagione.md`), l'utente ha aggiunto:
- **Preavviso:** il regista "arma" la radice di un momento un minuto prima (i passi di catena no); quel minuto la cronaca mostra l'azione
  che si costruisce. Se nel frattempo c'è un gol, il momento armato si annulla senza consumare budget.
  Ogni opzione mostra cosa succede se va male (`onFail`) e una fascia di probabilità (bassa, discreta,
  alta) coerente con il calcolo vero.
- **Respiro:** dopo un gol o la fine di una catena il regista non interviene per `relaxMinutes`
  (nel finale caldo per `hotGap`). Il minimo garantito lo ignora.
- **Insisti o chiudi:** dal secondo passo ogni catena offre un'opzione che chiude l'azione con un
  guadagno piccolo e sicuro: non estrae, riesce sempre, nessun gol.
- **Momenti per funzione:** la scelta del tipo penalizza la ripetizione e preferisce i tipi legati agli
  stati `dyn`.
- **Passo decisivo:** il report della partita indica il passo a tensione più alta e una riga di chiusura.
- **Momenti da leggenda:** opzioni rare e rischiose (rovesciata, cucchiaio, salvataggio sulla linea,
  doppia parata...) nell'ultimo passo di una catena, solo con tensione molto alta e abilità adatte; al
  massimo 1 a partita, premio più alto (voto, popolarità, prima pagina). Solo archetipi: nessun nome,
  data o richiamo esplicito a gol o giocatori reali.
- **Stagione:** riepilogo come prima pagina (1–3 titoli scelti per importanza) e un obiettivo per
  capitolo, con un piccolo effetto su fiducia del mister o morale.
- **Gesto (sostituisce §4.6 sul peso):** si parte da `qualityMaxBonus` 0,10 come oggi; il tetto dello
  schema sale a 0,15 e si alza solo se il simulatore mostra che la scelta pesa più del gesto. Il
  minigioco diventa utile per gesti diversi per azione e riscontro graduato, non per peso.
- **Correzioni:** il segnale "rivale in campo" diventa `keyOpponent` (avversario forte nel ruolo);
  `rival` resta riservato al rivale di carriera del documento del 17/11 §9.2, che avrà la precedenza.
  Il regista sceglie quando e che cosa proporre, mai l'esito: nessun aggiustamento nascosto delle
  probabilità.
