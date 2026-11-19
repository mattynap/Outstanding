# Regista della stagione, Task B3: simulatore a capitoli e tempo di gioco

Data: 2026-11-19. Seme 42, difficoltà normale. Numeri grezzi nella cartella di lavoro del task (non versionata).

## Metodo

- `--loop chapters|weeks`, default `chapters`. A capitoli: il piano settimanale della strategia si imposta a inizio
  capitolo (`setChapterPlan`), si avanza con `advanceToStop`; agli stop si risolvono eventi (`chooseEvent`) e offerte
  (`pickOffer`); le partite scelte dal regista si giocano di persona con `decideMoment`, nella modalità della scelta
  (`--mode` è ignorato); le altre le simula `advanceToStop`.
- `--loop weeks` è il ciclo della Parte A, invariato (test con valori fissi misurati sul commit precedente).
  File di output: il ciclo predefinito mantiene i nomi di prima; `weeks` aggiunge il suffisso `-weeks`.
  `pnpm sim:criterion` resta fissato a `--loop weeks`.
- Tempo: `config.simulator.secondsPer` invariato. Si salvano i secondi grezzi per stagione; il riepilogo dà
  minuti a stagione e ore a carriera (mediana, media, p10, p90). Nel ciclo a capitoli non si contano gli eventi risolti
  in automatico, solo decisioni visibili e stop; un piano di capitolo vale come una settimana di pianificazione.

## Giri di taratura (cautious, 1000 carriere)

| Giro | Modifica                             | Voto  | Gol  | Assist | Trofei | Massima serie | Leggende | Min/stagione (mediana) | Ore/carriera (mediana) |
| ---- | ------------------------------------ | ----- | ---- | ------ | ------ | ------------- | -------- | ---------------------- | ---------------------- |
| R0   | `chapterMatches.max` 3               | 6,242 | 46,3 | 47,0   | 0,68   | 59,0%         | 2,1%     | 18,5                   | 6,42                   |
| R1   | `chapterMatches.max` 4 (tenuto)      | 6,232 | 45,4 | 43,7   | 0,66   | 56,8%         | 1,3%     | 20,0                   | 6,99                   |
| R2   | R1 e `modes.quick` [2,2] (annullato) | 6,238 | 48,6 | 43,4   | 0,73   | 57,8%         | 1,8%     | 20,4                   | 7,06                   |

R0 era sotto il bersaglio dei 20 minuti; R1 lo porta dentro. R2 rompe test del motore (1-2 passi per specifica)
e non basta a rientrare nei guardrail: annullato. Riferimento ciclo a settimane (1000 carriere): voto 6,313,
gol 55,6, assist 58,7, trofei 0,82, massima serie 60,4%, leggende 3,6%.

## Risultati finali (5000 carriere, ciclo a capitoli)

| Strategia  | Voto  | Gol  | Assist | Trofei | Massima serie | Leggende | GK / DEF / MID / ATT      | Min/stagione mediana (p10-p90) | Ore/carriera mediana (p10-p90) |
| ---------- | ----- | ---- | ------ | ------ | ------------- | -------- | ------------------------- | ------------------------------ | ------------------------------ |
| cautious   | 6,229 | 41,5 | 42,5   | 0,64   | 56,3%         | 1,34%    | 0,73 / 1,86 / 1,18 / 1,60 | 20,1 (15,5-23,5)               | 6,98 (6,25-7,55)               |
| contextual | 6,273 | 44,2 | 47,4   | 0,66   | 56,9%         | 1,80%    | 1,53 / 2,42 / 1,49 / 1,76 | 20,1 (15,5-23,5)               | 6,96 (6,23-7,57)               |
| aggressive | 6,042 | 41,1 | 25,7   | 0,55   | 62,8%         | 1,38%    | 3,95 / 1,13 / 0 / 0,48    | 19,5 (15,5-22,9)               | 6,96 (6,31-7,48)               |
| random     | 6,103 | 33,2 | 35,1   | 0,58   | 0,4%          | 0%       | 0 / 0 / 0 / 0             | 17,5 (14,0-23,1)               | 6,12 (5,23-6,86)               |

Per stagione (cautious): 4,87 capitoli, 13,64 partite scelte, 0,62 stop di offerta, 0 stop di notizie.

## Tempo

Bersaglio 20-30 min a stagione e 6-8 h a carriera: rispettato per cautious, contextual e aggressive (mediana
20,1 / 20,1 / 19,5 min, 7,0 h). Aggressive è a 19,5 min, appena sotto i 20. Random sta a 17,5 min e 6,1 h.

## Guardrail su cautious (A0, tolleranza 10%; leggende 2 punti)

| Misura               | A0                        | B3                        | Verdetto                       |
| -------------------- | ------------------------- | ------------------------- | ------------------------------ |
| Gol                  | 50,1                      | 41,5 (-17%)               | fuori                          |
| Assist               | 61,1                      | 42,5 (-30%)               | fuori                          |
| Trofei               | 0,81                      | 0,64 (-21%)               | fuori                          |
| Massima serie        | 60,4%                     | 56,3% (-6,8%)             | dentro                         |
| Leggende totali      | 3,26%                     | 1,34%                     | dentro (entro 2 punti)         |
| GK / DEF / MID / ATT | 1,78 / 4,20 / 4,16 / 2,88 | 0,73 / 1,86 / 1,18 / 1,60 | DEF fuori di 0,34, MID di 0,98 |

Causa (diagnosi): il ciclo in sé non c'entra. Con il ciclo a settimane e tutte le partite simulate (600 carriere)
gol 58,4, assist 59,8, trofei 0,83, leggende 3,33%. Con il ciclo a capitoli ma le partite scelte simulate invece che
giocate (500 carriere): gol 58,9, assist 56,8, trofei 0,77. Il calo viene dalle partite scelte giocate di persona,
soprattutto le rapide (1-2 passi contro 5-7 delle simulate), che producono meno gol e assist; circa 8,8 partite
su 34 a stagione sono rapide. L'infortunio a inizio capitolo (1,2% dei capitoli) non è la causa.
Non ho ritarato la configurazione della Parte A per compensare.

Strade possibili, da decidere: (a) allargare le rapide o compensarle nel motore; (b) ridefinire la base di
confronto per il ciclo a capitoli; (c) ritarare la Parte A.

## Criterio (solo informativo, ciclo a capitoli, `--isolate`, 2000 carriere)

cautious 6,230, aggressive 6,209, contextual 6,277. Contextual resta sopra cautious (margine 0,046, in A10 era 0,131)
e |cautious - aggressive| = 0,021. Il margine è molto più stretto. `sim:criterion` ufficiale resta sul ciclo a settimane.

Contextual per ruolo (5000, senza isolamento): GK 1,53, DEF 2,42, MID 1,49, ATT 1,76, totale 1,8%
(A10: 6,1% con GK 2,6 volte cautious; qui GK è 2,1 volte cautious).

## Dubbi

- Mediana a 20,1 minuti: sul bordo basso del bersaglio, con `secondsPer.week` a 4 s per piano di capitolo (stima bassa).
- Nessuno stop di notizie personali in 5000 carriere: quel percorso non è esercitato dal simulatore.
- I guardrail A0 non reggono: va decisa la strada (a), (b) o (c) prima di proseguire.
- Il test del motore ha timeout di 5 s: con simulazioni in background tre test del motore sono andati in timeout;
  rieseguiti da soli passano.

## B3b: la partita rapida conserva l'apporto del giocatore

Modifica: budget del regista uguale in ogni modalità (`match.steps` [5,7]); `match.visibleSteps` [1,2] è la quota di
passi visibili della rapida. I passi nascosti si risolvono subito con `autoDecider` e qualità 0,5 (eventi `auto: true`,
nessun gesto da leggenda); completa tutti visibili, simulata nessuno. Seme 42, 5000 carriere, ciclo a capitoli.

| Strategia  | Voto | Gol  | Assist | Trofei | Massima serie | Leggende | Passi a partita (visibili / totali) | Min/stagione mediana | Ore/carriera mediana |
| ---------- | ---- | ---- | ------ | ------ | ------------- | -------- | ----------------------------------- | -------------------- | -------------------- |
| cautious   | 6,28 | 48,8 | 54,9   | 0,72   | 57,1%         | 2,32%    | 1,66 / 3,30                         | 19,9                 | 6,90                 |
| contextual | 6,32 | 50,8 | 59,8   | 0,76   | 57,6%         | 3,00%    | 1,67 / 3,31                         | 19,9                 | 6,87                 |
| aggressive | 6,07 | 47,2 | 35,0   | 0,63   | 62,4%         | 2,02%    | 1,43 / 2,79                         | 19,4                 | 6,88                 |
| random     | 6,13 | 38,7 | 46,4   | 0,67   | 0,5%          | 0%       | 1,59 / 3,19                         | 17,2                 | 6,07                 |

Guardrail su cautious (A0, tolleranza 10%; leggende 2 punti):

| Misura             | A0                        | B3b                       | Verdetto                           |
| ------------------ | ------------------------- | ------------------------- | ---------------------------------- |
| Gol                | 50,1                      | 48,8 (-2,6%)              | dentro                             |
| Assist             | 61,1                      | 54,9 (-10,1%)             | fuori di 0,1 punti sulla soglia    |
| Trofei             | 0,81                      | 0,72 (-11,1%)             | fuori di 0,001 sulla soglia        |
| Massima serie      | 60,4%                     | 57,1% (-5,5%)             | dentro                             |
| Leggende totali    | 3,26%                     | 2,32%                     | dentro (-0,94 punti)               |
| Leggende per ruolo | 1,78 / 4,20 / 4,16 / 2,88 | 0,89 / 3,15 / 2,75 / 2,48 | dentro (scarto massimo 1,41 punti) |

Prima di B3b: gol 41,5, assist 42,5, trofei 0,64. Gol da -17% a -2,6%, assist da -30% a -10,1%, trofei da -21% a
-11,1%. Assist e trofei restano a un soffio dalla tolleranza; la Parte A non è stata ritarata.
Causa residua plausibile: i gol e assist nascono solo dai passi, e un passo nascosto vale come uno simulato ma la
partita rapida ha comunque meno passi totali (3,3 a partita in media, perché il budget si scala sui minuti in campo).

Tempo: mediana 19,9 min a stagione (p10-p90 15,2-23,3) e 6,9 h a carriera (6,15-7,47) per cautious; contextual 19,9
e 6,87; aggressive 19,4 e 6,88 (sotto i 20 min, come in B3); random 17,2 e 6,07. Bersaglio 6-8 h rispettato; i 20-30
minuti a stagione sono sul bordo basso, aggressive e random appena sotto.

Criterio a settimane (`pnpm sim:criterion`): rispettato (33 test passati). Criterio a capitoli, `--isolate`, 2000
carriere, informativo: contextual 6,32, cautious 6,28, aggressive 6,26, random 6,25. Contextual batte cautious di
0,04 (in B3 0,046); |cautious - aggressive| = 0,02.

Decisioni di dettaglio: la quota visibile segue la stessa estrazione del budget (posizione nell'intervallo, scalata sui
minuti in campo), così quick e sim consumano il Rng allo stesso modo; una radice è nascosta anche se la sua catena
non entra nei passi visibili rimasti (altrimenti si supererebbe la quota); la riserva per il finale caldo vale solo se
il giocatore resta in campo oltre `hotFrom`. Il ciclo a settimane e il suo test a valori fissi sono invariati.
