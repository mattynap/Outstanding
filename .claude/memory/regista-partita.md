---
name: regista-partita
description: Parte A del regista della partita: decisioni stabili e numeri della taratura A10
type: project
---

# Regista della partita (Parte A, chiusa con A10)

- Il regista (`engine/src/match/director.ts`) decide quando fermare la partita e quale momento proporre,
  mai l'esito; le fasce `chanceBand` derivano dalla probabilità vera. Salvataggio v2 copre tutta la Parte A.
- Modalità: completa 5-7 passi, rapida 1-2, `sim` (autoDecider) senza pause. Il simulatore ha `--isolate`
  (stesse scelte fuori campo per tutte le strategie), `--quality`, `--mode`.
- Criterio §8.3 si misura sempre con `--isolate`; `pnpm sim:criterion` (2000 carriere, circa 20 min).
- Taratura A10: premio al successo +0,25 sulle opzioni rischiose non leggenda (`moments.json`) e
  `career.json > score.roleFactors` GK 1,8, DEF 1,0 (il voto dei GK/DEF era salito e il fattore
  amplificava le leggende). `qualityMaxBonus` resta 0,10; `legends.ratingBonus` resta 1 (0,5 non cambia nulla);
  `dyn`, `risk.*`, `pressure.goalBoost` ai pesi iniziali.
- A 5000 carriere (isolate): contextual 6,444, prudente 6,313, aggressiva 6,181. Prudente contro A0: gol 50,6,
  assist 56,6, trofei 0,77, massima serie 59,2%, leggende 3,54% (GK 2,5, DEF 5,0, MID 3,2, ATT 3,5).
  Contextual: leggende 6,1% (GK 6,5, DEF 8,8): circa il doppio della prudente, accettato.
- Tempo stimato (cautious): completa 85 min a stagione e 29,5 h a carriera, rapida 22,5 min e 7,9 h. Bersaglio
  20-30 min e 6-8 h: la completa non ci rientra; decisione dell'utente. Non tarare `secondsPer` per forzarlo.
- Una carriera da 1000 su 10 core: circa 3 minuti; 5000 circa 13. 1000 carriere sono rumorose (gol, leggende GK).
- Dettaglio dei giri in `reports/regista/confronto-A10.md`.
