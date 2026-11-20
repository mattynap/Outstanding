# Baseline del simulatore prima della settimana leggibile

Commit di riferimento: `62d65e7` (nessuna modifica al motore dopo `d8a5067`). Difficoltà `normal`, seme 42, 5000 carriere, ciclo a capitoli (default del simulatore).

Comandi:

```
pnpm sim --careers 5000 --strategy cautious --seed 42 --out reports/settimana-leggibile
pnpm sim --careers 5000 --strategy contextual --seed 42 --out reports/settimana-leggibile
```

JSON grezzi (riepilogo, senza `--details`): `sim-cautious-normal-42-5000.json`, `sim-contextual-normal-42-5000.json` (circa 10 KB ciascuno). Esecuzione in parallelo sulla stessa macchina: circa 96 minuti ciascuna.

## Numeri (totale carriere)

| Metrica | cautious | contextual |
|---|---|---|
| Arrivano in massima serie | 57,2% | 57,1% |
| Età d'esordio in massima serie | 25,9 | 25,8 |
| OVR massimo medio | 67,8 | 67,8 |
| Presenze medie | 637,4 | 638,9 |
| Gol medi | 49,4 | 52,1 |
| Leggende | 2,50% | 3,22% |
| Punteggio medio (`score.total`) | 1494 | 1603 |
| Minuti a stagione (mediana / media / p10 / p90) | 20,1 / 19,2 / 15,5 / 23,5 | 20,1 / 19,2 / 15,5 / 23,5 |
| Ore a carriera (mediana / media / p10 / p90) | 6,94 / 6,91 / 6,19 / 7,56 | 6,94 / 6,9 / 6,19 / 7,55 |

Altri riferimenti utili: età di ritiro 36,8 (entrambe); media voto 6,27 / 6,32; trofei 0,76 / 0,76; assist 55,4 / 58,2; stagioni in massima serie 3,4 / 3,5; 4,87 capitoli e 13,65 partite scelte a stagione.

## Criteri di confronto (criterio 5)

- % massima serie, OVR massimo medio, presenze: entro ±10% del valore di riferimento di questa tabella, per ciascuna strategia.
- Leggende: tra 1% e 5%.

Intervalli derivati: % massima serie cautious 51,5–62,9 (57,2), contextual 51,4–62,8 (57,1); OVR massimo 61,0–74,6; presenze cautious 573,7–701,1, contextual 575,0–702,8.

Entrambe le strategie sono oggi nell'intervallo leggende 1–5%.

## Note

- Tutte le metriche richieste sono prodotte dal simulatore; nessun calcolo aggiuntivo.
- I tempi (minuti a stagione, ore a carriera) sono quelli del ciclo a capitoli; il ciclo a settimane (`--loop weeks`) non li produce.
- Le due strategie differiscono quasi solo nei momenti chiave: i valori su massima serie, OVR e presenze coincidono entro il rumore.
