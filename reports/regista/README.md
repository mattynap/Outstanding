# Baseline del simulatore prima del regista (Task A0)

Comando: `pnpm sim --careers 5000 --strategy all --seed 42 --out reports/regista/baseline`
(difficoltà normal, 5000 carriere per strategia). File: `baseline-cautious.json`, `baseline-aggressive.json`, `baseline-random.json`.
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

Metodo: 2000 partite del giocatore (carriera `newCareer` con le opzioni di `test/fixtures.ts`, una stagione per seme, semi 42, 43, ...) giocate con `autoDecider`.

- Gol per partita, le due squadre insieme: **2,807**
- Gol della squadra del giocatore: **1,5545**
- Momenti chiave per partita (chiamate al decisore): **1,938**
- Voto medio nelle partite con voto: 6,405; minuti giocati medi: 57,0

Il Task A3 verifica i gol totali per partita entro ±5% della baseline (2,667-2,947).

## Tolleranza dei guardrail

±10% relativo su ogni metrica; per le percentuali sotto il 20% la tolleranza è ±2 punti assoluti.
