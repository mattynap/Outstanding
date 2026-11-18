# Regista della partita e della stagione: design

Data: 2026-11-18 · Stato: bozza approvata nella direzione, da completare (builder check) prima del piano
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
- Da decidere con l'utente: cosa succede alla pianificazione settimanale (diventa per capitolo?),
  se il giocatore può chiedere di giocare una partita non scelta, interazione con avanti veloce e
  piano ricordato già esistenti.

## 6. Vincoli

- Motore puro e deterministico (CLAUDE.md §5); nessun numero magico, tutto in `config/` con Zod.
- `GameState` cambia: `saveVersion` + migrazione + test.
- Ogni modifica a `config/` con confronto del simulatore (prima/dopo).
- La UI usa il design system ibrido (`docs/design-system.md`) e la skill `frontend-design`.

## 7. Lasciato a chi costruisce (da completare)

- Formula esatta della tensione e soglie: proposta + taratura col simulatore.
- Formato dati delle catene e degli stati della partita.
- Nuova strategia "contestuale" nel simulatore.
- Builder check di questo documento prima del piano (skill `writing-plans`).
