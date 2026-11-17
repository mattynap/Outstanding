# Decisioni tecniche

<!-- Solo in coda. Formato:
## YYYY-MM-DD — titolo
- Decisione:
- Perché:
- Alternative scartate:
Decisioni con il cliente o commerciali: proporle per il registro di base-aziendale. -->

## 2026-11-17 — Tempo reale come dato dei comandi
- Decisione: tutto ciò che viene dal mondo reale (qualità del minigioco, ore di assenza, video visto) entra nel motore come dato dei comandi (`decide` → `{ optionIndex, quality }`, `collectIdle(hours)`, `grantReward(kind)`).
- Perché: il motore resta puro e deterministico (CLAUDE.md §5).
- Alternative scartate: leggere l'orologio o lo stato pubblicitario dentro il motore.
