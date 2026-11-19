# Taratura A10: confronto con la baseline A0

Seme 42, difficoltà normal. Baseline A0 (cautious, 5000 carriere, non isolata): gol 50,1, assist 61,1,
trofei 0,81, massima serie 60,4%, leggende 3,26% (GK 1,78, DEF 4,20, MID 4,16, ATT 2,88), voto 6,24.
Guardrail: gol, assist, trofei e massima serie entro ±10%; leggende totali e per ruolo entro ±2 punti.
Il criterio (spec §8.3) si misura sempre con `--isolate`.

## Passo 1: stato prima della taratura (5000 carriere, senza isolamento)

| Strategia  | Voto  | Gol  | Assist | Trofei | Massima serie | Leggende | GK    | DEF  | MID  | ATT  |
| ---------- | ----- | ---- | ------ | ------ | ------------- | -------- | ----- | ---- | ---- | ---- |
| cautious   | 6,261 | 49,9 | 56,5   | 0,79   | 59,1%         | 3,72%    | 4,04  | 4,12 | 3,45 | 3,29 |
| aggressive | 5,683 | 45,5 | 15,6   | 0,63   | 61,3%         | 1,06%    | 3,63  | 0,57 | 0    | 0,08 |
| contextual | 6,344 | 53,4 | 67,9   | 0,82   | 60,1%         | 6,04%    | 11,62 | 5,33 | 3,14 | 4,17 |
| random     | 6,018 | 42,1 | 40,6   | 0,67   | 0,1%          | 0%       | 0     | 0    | 0    | 0    |

Già qui il guardrail delle leggende GK della cautious era fuori (4,04 contro 1,78 + 2 = 3,78): il voto dei
portieri era salito da 6,07 a 6,21 e il punteggio di carriera del GK (fattore 2,33, peso del voto al
massimo livello 6) lo amplifica.

Criterio con `--isolate`, 1000 carriere (giro 0): cautious 6,263, aggressive 5,935, contextual 6,347.
Per ruolo (aggressive contro cautious): GK 6,28/6,20, DEF 6,09/6,31, MID 5,49/6,24, ATT 5,91/6,30.
Differenza prudente-aggressiva 0,33: il terzo punto falla, quasi tutto nei MID.

Diagnosi (150 carriere MID): l'aggressiva sceglie sempre l'opzione rischiosa, che riesce il 20-35% delle
volte (tiro da fuori 21%, anticipo 37%, scivolata 30%) e perde 0,25-0,75 di voto al fallimento, mentre
la prudente riesce il 55-77% e fa più passi di catena (4,1 contro 3,4 a partita, grazie a "chiudi" e ai
recuperi in copertura che riescono sempre). Le opzioni rischiose rendevano meno di quanto costavano.

## Giri di taratura (1000 carriere, `--isolate`, cautious e aggressive)

| Giro | Parametro                                                                      | Prima -> dopo           | cautious  | aggressive | Differenza | Esito                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------ | ----------------------- | --------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | difficoltà delle opzioni rischiose MID (inserimento, tiro da fuori, dribbling) | 12/16/5 -> 9/12/4       | 6,263     | 5,948      | 0,32       | annullato: effetto +0,01 sul voto (MID 5,49 -> 5,54)                                                                                                               |
| 2    | voto al successo delle 23 opzioni rischiose non leggenda (`moments.json`)      | +0,25                   | 6,313     | 6,163      | 0,15       | tenuto                                                                                                                                                             |
| 3    | `career.json > score.roleFactors` GK, DEF                                      | 2,33 -> 1,8; 1,1 -> 1,0 | invariato | invariato  |            | tenuto (solo leggende, vedi sotto)                                                                                                                                 |
| 4    | `match.json > legends.ratingBonus`                                             | 1 -> 0,5                |           |            |            | annullato: contextual (prova a 2000 carriere, non 1000 come nell'intestazione) GK 6,4% DEF 10,3% totale 6,2%, nessun effetto misurabile sulle leggende, voto 6,462 |

Giro 2, guardrail della cautious a 5000 carriere prima del giro 3: gol 50,6, assist 56,6, trofei 0,77,
massima serie 59,2%, voto 6,313, leggende 4,46% con GK 4,68 e DEF 6,54 (fuori: GK > 3,78, DEF > 6,2).
Il giro 3 è stato scelto sul ricalcolo del punteggio sui 5000 risultati salvati (`--details`, fattori GK 2,0..1,7
e DEF 1,0..0,95): con GK 1,8 e DEF 1,0 la cautious dà GK 2,5 e DEF 5,01, totale 3,54. Il ricalcolo è esatto a meno
dell'arrotondamento delle voci; il run finale lo conferma (stessi numeri).

Perché i fattori di ruolo e non altro: il voto medio dei portieri e dei difensori è salito con il regista
(più passi, recuperi), e il punteggio moltiplica il voto per un fattore di ruolo pensato per il voto di prima.
Riportare il fattore a un valore coerente con i nuovi voti riporta le leggende nella tolleranza senza toccare
il gioco in campo. `qualityMaxBonus` resta 0,10 (il gesto non ha servito alla taratura, e il guardrail
non lo richiedeva); `dyn.chanceWeight`, `risk.*` e `pressure.goalBoost` non sono stati alzati: i guardrail e il
criterio reggono con i pesi iniziali, quindi non c'era motivo di aumentare la varianza delle partite.

## Stato finale (5000 carriere, seme 42)

Cautious senza isolamento (guardrail) e le tre strategie con `--isolate` (criterio); random senza isolamento.

| Strategia            | Voto  | Gol  | Assist | Trofei | Massima serie | Leggende | GK   | DEF  | MID  | ATT  |
| -------------------- | ----- | ---- | ------ | ------ | ------------- | -------- | ---- | ---- | ---- | ---- |
| cautious             | 6,313 | 50,6 | 56,6   | 0,77   | 59,2%         | 3,54%    | 2,50 | 5,01 | 3,22 | 3,45 |
| aggressive (isolate) | 6,181 | 67,2 | 22,6   | 0,71   | 56,1%         | 2,10%    | 3,63 | 4,28 | 0    | 0,56 |
| contextual (isolate) | 6,444 | 57,5 | 66,6   | 0,83   | 59,7%         | 6,10%    | 6,54 | 8,80 | 3,37 | 5,77 |
| random               | 6,107 | 42,4 | 41,0   | 0,69   | 0,0%          | 0%       | 0    | 0    | 0    | 0    |

Guardrail della cautious contro A0: gol +1,0%, assist -7,4%, trofei -4,9%, massima serie -2,0% (tutti entro
10%); leggende 3,54% contro 3,26% (+0,28), GK +0,72, DEF +0,81, MID -0,94, ATT +0,57 (tutti entro 2 punti). Voto 6,313 contro 6,24 di A0.

Criterio §8.3 a 5000 carriere, `--isolate`: contextual 6,444 > cautious 6,313; contextual > aggressive 6,181;
|cautious - aggressive| = 0,132 <= 0,2. Verificato. `pnpm sim:criterion` (2000 carriere) passa, 30 test su 30.

Voto per ruolo (isolate, cautious / aggressive / contextual): GK 6,24/6,50/6,56, DEF 6,43/6,44/6,57,
MID 6,23/5,70/6,23, ATT 6,35/6,10/6,42. Il MID resta il punto debole dell'aggressiva (-0,53), ma la media rientra.

## Leggende per ruolo e contextual

La contextual dà il 6,1% (cautious 3,5%): circa 1,7 volte, GK 2,6 volte (6,54 contro 2,50), DEF 1,8 volte.
Prima della taratura era 11,6% sui GK e 6,04% in totale. Il giro 4 ha provato ad abbassare il bonus di voto
dei gesti: nessun effetto. Resta oltre il doppio sui GK solo per la strategia contextual, che sceglie
i gesti da leggenda quando il valore atteso li giustifica; non tocca il guardrail della prudente. Se si
vuole più vicina, la leva è `score.roleFactors.GK` (1,7 dà GK 5,7 contextual e 2,2 cautious), non il gioco in campo.

Punto aperto: leggende contextual 6,1% (GK 2,6 volte la prudente); leva `score.roleFactors.GK`.

## Voci rimandate da A10

- a. `value` usa gesto neutro 0,5: tenuto. Il gesto si sceglie dopo aver visto le opzioni e `chance` mostrata
  è ugualmente al valore neutro (±`qualityMaxBonus` uniforme su tutte le opzioni, quindi non cambia l'ordine
  tra le opzioni se non vicino ai limiti 5-90%). Il valore resta confrontabile con la fascia mostrata.
- b. Contropiede e `onFail`: già modellato. Un seguito (`failure.next`, es. `counter_recovery` con
  probabilità 0,6) entra in `optionValue` come `c * continuation`, e il valore del seguito include il
  gol subito pesato (`goalAgainst * w * goalValue`) della miglior risposta. Nessuna modifica.
- c. Test dell'isolamento: rafforzato (stesse funzioni della prudente, e su tre stagioni simulate (stati reali, partite uguali per tutti)
  le stesse decisioni fuori campo per le quattro strategie isolate, mentre senza isolamento
  l'aggressiva diverge).
- d. `?? 'quick'` rimosso (la rapida si verifica solo se si ferma, con un contatore che deve essere > 0) e
  l'espressione `[1-3]` del picco sostituita dal controllo contro `config.match.peak.variants`.
- e. Vedi sopra. f. Pesi leggende e aggressiva toccati come sopra; il significato di "aggressiva" non cambia
  (sempre l'opzione più rischiosa): cambia solo il premio delle opzioni rischiose nei dati.

## Tempo e passi

Passi interattivi per partita in modalità completa (60 carriere cautious, titolare): media 5,05; 5-7 passi
nel 69% delle partite da titolare e nell'81,5% di quelle con almeno 85 minuti (1:10 2:17 3:43 4:83 5:249 6:246 7:181);
mai oltre 7. Rapida: 1-2 passi, 1,48 in media (428 da 1, 397 da 2).

Stima del tempo (secondi per decisione invariati, non tarati). Cautious, 5000 carriere, 20,9 stagioni:

| Modalità                                               | min/carriera      | min/stagione |
| ------------------------------------------------------ | ----------------- | ------------ |
| completa (le grandi partite)                           | 1769 (29,5 h)     | 84,6         |
| rapida (`--mode quick`, 1000 carriere)                 | 471 (7,9 h)       | 22,5         |
| completa, solo le partite da titolare (65% del totale) | circa 1800 (30 h) | circa 86     |
| rapida, solo da titolare                               | circa 476 (7,9 h) | circa 22,8   |

Il bersaglio è 20-30 min a stagione e 6-8 ore a carriera. Solo la modalità rapida ci rientra; la completa
supera il bersaglio di quasi 4 volte (554 partite complete a carriera per 150 s sono già 23 ore). La scelta di
quali partite giocare in modalità completa (per esempio 2-3 a stagione, come nella Parte B) o dei secondi per
partita è dell'utente; il simulatore non è stato tarato per raggiungerlo.
