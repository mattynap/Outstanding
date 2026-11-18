# Baseline del simulatore prima del regista (Task A0)

Comando: `pnpm sim --careers 5000 --strategy all --seed 42 --out reports/regista/baseline`
(difficoltà normal, 5000 carriere per strategia). File: `baseline-cautious.json`, `baseline-aggressive.json`, `baseline-random.json`.
La CLI scrive `sim-<strategy>-normal-42-5000.json`; i file sono stati rinominati in `baseline-<strategy>.json`.
Ogni modifica a `config/` si confronta con questi numeri.

## Tabella (totale, tutti i ruoli)

| Metrica | cautious | aggressive | random |
|---|---|---|---|
| Arrivano in massima serie | 60,4% | 61,9% | 0,1% |
| Età esordio in massima serie | 25,6 | 23,1 | 30 (pochi casi) |
| Presenze | 652 | 586 | 549,9 |
| Gol | 50,1 | 37,8 | 41,9 |
| Assist | 61,1 | 20,7 | 48,2 |
| Trofei per carriera | 0,81 | 0,61 | 0,71 |
| Età di ritiro | 37 | 37,7 | 36,3 |
| Leggende | 3,26% | 0,56% | 0% |
| Voto medio | 6,24 | 5,77 | 6,09 |
| Tempo stimato (min/carriera) | 361 | 348 | 289 |
| Tempo stimato (ore/carriera) | 6,0 | 5,8 | 4,8 |
| Stagioni per carriera | 20,9 | 21,6 | 20,1 |
| Tempo stimato (min/stagione) | 17,3 | 16,1 | 14,4 |

Tempo stimato = `playMinutes` del riepilogo. Nota: la stagione (16-17 min) è sotto i 20-30 min del target, la carriera (5,8-6 h) è al limite basso dei 6-8 h.

## Gol per partita (motore attuale)

Metodo: 2000 partite del giocatore, una stagione per carriera (semi 42, 43, ...), tutte con `autoDecider`. Il calendario del motore include anche le coppe, quindi le partite di coppa del club del giocatore sono nel campione; nessuna scelta fuori campo (niente `planWeek`), si usa solo `advanceWeek`. Il campione si ferma a 2000 partite (la stagione in corso è interrotta lì).

Procedura esatta (salvare come `goals.ts` in una cartella fuori dal repository, poi dalla radice: `node_modules/.bin/tsx <percorso>/goals.ts`; adattare i percorsi assoluti):

```ts
import { advanceWeek, autoDecider, isSeasonOver, newCareer, playerFixture, playMatch } from '<radice>/packages/engine/src/index';
import { baseOptions } from '<radice>/packages/engine/test/fixtures';
let n = 0, tot = 0, own = 0, moments = 0, rated = 0, ratingSum = 0, mins = 0;
for (let seed = 42; n < 2000; seed++) {
  let s = newCareer(baseOptions, seed); // ATT di Bergamo, tratto bomber_area
  while (!isSeasonOver(s) && n < 2000) { // una sola stagione per seme
    const f = playerFixture(s);
    if (f && !f.result) {
      let calls = 0;
      const r = playMatch(s, (m, st) => { calls++; return autoDecider(m, st); });
      s = r.state; const m = r.matchReport;
      n++; tot += m.score.home + m.score.away; own += m.score[m.side]; moments += calls;
      if (m.rating != null) { rated++; ratingSum += m.rating; }
      mins += m.minutesPlayed;
    }
    s = advanceWeek(s).state;
  }
}
console.log({ n, totalGoals: tot / n, ownSideGoals: own / n, momentsPerMatch: moments / n, rating: ratingSum / rated, minutes: mins / n });
```

Risultati:

- Gol per partita, le due squadre insieme: **2,807**
- Gol della squadra del giocatore: **1,5545**
- Momenti chiave per partita (chiamate al decisore): **1,938**
- Voto medio nelle partite con voto: 6,405; minuti giocati medi: 57,0

Il Task A3 verifica i gol totali per partita entro la tolleranza `baseline × 0,95 … × 1,05` = 2,667 … 2,947 (arrotondato).

## Tolleranza dei guardrail

±10% relativo su ogni metrica; per le percentuali sotto il 20% la tolleranza è ±2 punti assoluti.
