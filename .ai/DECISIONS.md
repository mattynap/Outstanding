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

## 2026-11-17 — Phaser 4 come renderer mobile
- Decisione: Phaser 4.2.1 differito in Angular/Capacitor; il motore TypeScript resta autorevole.
- Perché: scene e input sul dispositivo senza duplicare carriera o salvataggi. Prove in `reports/prove-motore-mobile/README.md`.
- Alternative scartate: migrazione Godot/Unity e renderer manuale, per costo di riscrittura e manutenzione.
