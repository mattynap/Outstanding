# Meccaniche per il regista della partita e della stagione

Data: 2026-11-18. Revisione del piano `docs/superpowers/plans/2026-11-18-regista-partita-stagione.md`
e ricerca sulle meccaniche che lo possono arricchire. Focus: un regista che colga il tempismo e
intrattenga (partita meno piatta, stagione più corta).

## 1. Conclusione

Il piano regge, ma lascia scoperto il punto che l'utente lamenta di più: il momento chiave che
"arriva dal nulla". Le cinque ricerche convergono sulla stessa lezione: **prima il segnale, poi la
scelta, poi il seguito visibile**. Il piano costruisce la pressione e la tensione, ma non fa
vedere al giocatore che cosa le genera, né richiama dopo quello che è successo.

Le aggiunte proposte sono poche e poco costose, perché si appoggiano a stati che il piano crea già
(pressione, `dyn`, catene, stakes). Nessuna tocca l'esito in segreto: il regista sceglie **quando** e
**che cosa** proporre, mai il risultato.

## 2. Problemi trovati nella revisione

| # | Problema | Dove | Correzione proposta |
|---|---|---|---|
| R1 | Nessuna cronaca prodotta dal motore: c'è solo la traccia della pressione. Il momento resta senza preavviso. | A3, A5 | Nuovo evento di cronaca `buildup` e righe di pressione (proposta P1). |
| R2 | Il segnale `rival` (giocatore avversario forte nel tuo ruolo) contraddice il rivale persistente del 17/11 §9.2, non ancora implementato. | A4 | Rinominare in `keyOpponent`; riservare `rival` al rivale di carriera, che avrà la precedenza quando esisterà. |
| R3 | A3 tiene i minuti dei momenti in una variabile locale "derivata dal seme": a metà partita la ripresa non è garantita fra A3 e A5. | A3 | Tenere i minuti pianificati in `director.plannedMinutes` (campo provvisorio di v2, tolto in A5; v2 non esce prima di A5, quindi niente migrazione extra). |
| R4 | Il piano alza il tetto del gesto a 0,25. La ricerca indica ±5–8 punti come peso sano; la "inutilità" del minigioco viene dalla barra uguale per tutto, non dal peso basso. | A1, A10 | Decisione dell'utente (§5). |
| R5 | Nessun vincolo esplicito contro l'aggiustamento nascosto dell'esito (DDA). | Vincoli globali | Una riga nei vincoli: il regista non modifica probabilità né esiti. |

## 3. Meccaniche proposte (partita)

**P1. Preavviso dell'azione (telegrafare la minaccia).** Quando il regista decide di intervenire al
minuto *m*, la cronaca dei 1–2 minuti prima mostra l'azione che si costruisce ("Il terzino sale, spazio
sulla fascia"), scelta dal tipo di momento e dalla fase. Nel momento, ogni opzione indica cosa succede
se va male (`onFail`: contropiede, palla persa, niente) e una fascia di probabilità (bassa, discreta,
alta) coerente con il calcolo vero.
Fonti: Into the Breach, Slay the Spire (intento nemico), Playable Highlights di EA FC, manuale di
Football Manager. Costo: piccolo. Il motore emette eventi `buildup` con chiave di testo; i testi
stanno in `content`. Rischio: troppe informazioni fanno diventare il momento un puzzle. Bastano una
riga e una fascia.

**P2. Respiro dopo il picco.** Dopo un gol o la fine di una catena, la tensione viene smorzata per
`relaxMinutes` (iniziale 4), e la cronaca fa scorrere l'esultanza e la ripresa. Il picco resta un
picco, e gli interventi non si accavallano.
Fonte: ciclo Build Up → Peak → Fade → Relax dell'AI Director di Left 4 Dead. Costo: un parametro e un
controllo in `shouldIntervene`.

**P3. Insisti o chiudi (push your luck nelle catene).** Dal secondo passo in poi, ogni catena offre
un'opzione "chiudi": guadagni un corner, un fallo o un piccolo +voto, e l'azione finisce. Le altre
opzioni proseguono verso il colpo grosso, con il rischio del contropiede. È una regola di contenuto,
non di codice, perché lo schema ammette già opzioni senza `next`.
Fonti: push your luck, turnover di Blood Bowl. Rischio: se insistere conviene sempre, diventa la
strategia dominante. Lo misura la strategia contestuale in A8.

**P4. Momenti diversi per funzione, non a caso.** La scelta del tipo separa il "quando" (la tensione)
dal "che cosa": penalità di ripetizione sull'ultimo tipo proposto (`repeatPenalty`) e preferenza per i
tipi legati agli stati (marcatura alta, quindi più passaggi o sponde; nervosismo alto, quindi il
momento "mantieni la calma").
Fonti: sequencer a beat di Façade, storylet basati su qualità (Emily Short), eventi di Wildermyth.
Costo: un campo `lastTypes` nello stato del regista e un peso in config.

**P5. Picco e chiusura nella pagella (regola picco-fine).** Il report della partita indica il **passo
decisivo** (quello a tensione più alta, con il suo esito) e una riga di chiusura legata a quel
momento. La stessa informazione alimenta i titoli del riepilogo di stagione (P7).
Fonte: studi sulla regola picco-fine nei giochi (Gutwin e altri, CHI). Costo: un campo
`peak` nel `matchReport`.

**P6. Richiami nella cronaca.** Le righe di cronaca e i testi dei momenti possono avere condizioni
sugli stati `dyn` ("dopo il tunnel del 23', ora ti raddoppiano"). Si limita a far vedere al giocatore
che il gioco ricorda: le probabilità non cambiano.
Fonti: reattività di Hades, Dynamics di Football Manager. Costo: condizioni opzionali sulle chiavi di
testo; il grosso è contenuto.

**Scartate o rimandate**
- Indicatore di slancio a livelli (Takeover di NBA 2K, Spirit di Captain Tsubasa): si autoalimenta e
  aggiunge una barra. Per ora basta il `dyn` nervosismo e fiducia; da riconsiderare dopo A10.
- Profili di ritmo stile RimWorld (Cassandra, Phoebe, Randy): utili per la rigiocabilità, ma fuori dal
  focus. Una possibile impostazione futura.
- Percentuali precise a schermo: meglio le fasce (rischio XCOM: un numero preciso che "mente").

## 4. Meccaniche proposte (stagione)

**P7. Riepilogo come prima pagina.** Il riepilogo delle giornate saltate non è una tabella: sono 1–3
titoli scelti per importanza (passo decisivo delle partite giocate, risultato del club, classifica,
evento chiave), poi classifica e voti in forma compatta. Il piano B2 ha già un `summary`: si aggiunge
`headlines` con regole di priorità in config.
Fonti: Football Chairman e Premier Manager (schermate di stagione); direzione visiva "giornale
sportivo" di CLAUDE.md §10.

**P8. Obiettivo del capitolo.** A inizio capitolo il regista della stagione propone un obiettivo
ricavato dallo stato ("conquista il posto da titolare", "segna nel derby", "resta sopra il 6,5 di
media"). A fine capitolo l'esito sposta la fiducia del mister o il morale, e compare fra i titoli.
L'obiettivo non blocca nulla e non punisce troppo: uno specchio, come il rivale.
Fonti: Reigns: Her Majesty, calendario di Persona 5. Rischio: diventare una lista di compiti. Basta
un obiettivo per capitolo. Costo: medio (elenco in `content`, condizioni come gli eventi).

## 5. Gesto: decisione da prendere

Lo spec dice "il peso del gesto sale" rispetto ai ±10 punti di oggi. La ricerca suggerisce l'opposto:
±5–6 punti per partire, ±6–8 al massimo. Il tempismo non deve mai essere essenziale (Game
Accessibility Guidelines, Xbox Accessibility Guideline 107), e la latenza del tocco va da 94 a
187 ms a seconda del dispositivo (studio IEEE). Il gesto serve a dare la sensazione di avere in mano
l'azione: la spinta deve venire da gesti diversi per azione e da un riscontro graduato ("impreciso",
"buono", "ottimo"), non dal peso.

Proposta: si parte da 0,10 (come oggi), il tetto nello schema passa a 0,15 (non a 0,25), e in A10 si
sale solo se il simulatore mostra che la scelta resta più importante del gesto.

## 6. Impatto sul piano

| Proposta | Task | Cosa cambia |
|---|---|---|
| R2 | A4 | `rival` → `keyOpponent`; `rival` riservato al 17/11 §9.2 |
| R3 | A3, A5 | `director.plannedMinutes` provvisorio |
| R4 | A1, A10 | tetto di `qualityMaxBonus` a 0,15; partenza a 0,10 |
| R5 | Vincoli globali | nessun aggiustamento nascosto dell'esito |
| P1 | A5, A7 | eventi `buildup` nella cronaca, `onFail` e `chanceBand` nelle opzioni |
| P2 | A1, A5 | `director.relaxMinutes`, smorzamento dopo gol e catene |
| P3 | A7 | regola di contenuto: opzione "chiudi" dal secondo passo |
| P4 | A5 | `repeatPenalty`, preferenza per stato, `lastTypes` |
| P5 | A9 | `matchReport.peak` |
| P6 | A7 (contenuti) | condizioni `dyn` facoltative sulle righe di cronaca |
| P7 | B2 | `summary.headlines` con priorità in config |
| P8 | nuovo B4 | obiettivo del capitolo |

## 6b. Decisioni dell'utente (2026-11-18)

- Adottate: P1, P2, P3, P4, P5, P7, P8; correzioni R2, R3, R5.
- Non adottata per ora: P6 (richiami in cronaca).
- Gesto: resta 0,10, tetto 0,15.
- Aggiunta dell'utente, **P9 momenti da leggenda**: opzioni rare e rischiose ispirate ai grandi gesti
  del calcio (rovesciata, cucchiaio, salvataggio sulla linea, doppia parata...), con il protagonista
  come soggetto, solo come archetipi senza nomi né date reali. Nuovo Task A7b.

## 7. Fonti

- M. Booth, *The AI Systems of Left 4 Dead*, AIIDE 2009: https://valvearchive.com/Presentations/AIIDE%202009/ai_systems_of_l4d_mike_booth.pdf
- Mateas e Stern, *Façade*, GDC 2003: https://sites.cc.gatech.edu/fac/Charles.Isbell/classes/reading/papers/MateasSternGDC03.pdf
- E. Short, *Beyond Branching*: https://emshort.blog/2016/04/12/beyond-branching-quality-based-and-salience-based-narrative-structures/
- Wildermyth, Event design philosophy: https://wildermyth.com/wiki/Event_design_philosophy
- Gutwin e altri, regola picco-fine nei giochi: https://www.benlafreniere.ca/assets/papers/p5608-gutwin.pdf
- Hunicke e Chapman, *Hamlet* (DDA): https://www.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf
- EA, Pitch Notes FIFA 23 Career: https://www.ea.com/ea-play/news/pitch-notes-fifa-23-career-deep-dive
- Sports Interactive, manuale partita FM24: https://community.sports-interactive.com/sigames-manual/football-manager-2024/playing-a-match-r4966/
- EA, Madden Superstar: https://www.ea.com/technology/news/madden-24-superstar-mode
- Subset Games, Into the Breach: https://subsetgames.com/itb.html
- Ars Technica, War Stories Slay the Spire: https://arstechnica.com/video/watch/war-stories-slay-the-spire-war-stories/
- Sid Meier, *Interesting Decisions*, GDC: https://www.gdcvault.com/play/1016165/Interesting
- 2K, NBA 2K25 MyCareer: https://newsroom.2k.com/news/lead-the-next-great-dynasty-in-nbar-2k25-with-new-mycareer-and-myplayer-builder-updates-for-playstationr5-xbox-series-xs-and-pc
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/full-list/
- Xbox Accessibility Guideline 107: https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107
- Latenza touch nei giochi (IEEE): https://ieeexplore.ieee.org/document/10596790/
- Devolver, Reigns: Her Majesty: https://www.devolverdigital.com/games/reigns-her-majesty
- Atlus, Persona 5: https://atlus.com/note-persona-5-streaming/

Non verificato: aggiustamenti nascosti di XCOM (fonte solo comunitaria), finestre di tempismo in ms
dei giochi citati, regola "simula fino alla prossima partita" di EA FC, dettagli di Score! Hero e
Retro Goal. Sono esempi di pattern di gioco, non una valutazione legale: il sistema Nemesis resta da
evitare per il rivale.
