---
name: ui-ibrido
description: Interfaccia ibrida giornale + pixel (2026-11-17): regole fisse e dove stanno, ondate 1-2 fatte, ondata 3 dopo prova su iPhone
metadata:
  type: project
---

Direzione scelta dall'utente il 2026-11-17: "ibrido spinto, mantieni lo stile di giornale".
Piano: `docs/superpowers/plans/2026-11-17-ui-ux-ibrido.md`; regole visive in `docs/design-system.md`.

- Font pixel (Jersey 15, `.o-num`) solo da 20 px in su; testi in Inter, titoli in Barlow Condensed.
- Cornici pixel solo con box-shadow, colore con `--px-b`; carta con `.o-paper` / `.o-px--paper`.
- Bene/male sulla carta: `--o-ink-pos` / `--o-ink-neg` (i verdi/rossi del tema non passano AA sulla carta).
- Partita: modalità predefinita `full|sim` in Preferences `outstanding.matchMode`; `/partita?mode=sim` va dritto alla pagella.
- Guida: prima della prima partita solo welcome, cta, momenti; il resto dopo la prima pagella (`core/tutorial.ts`).
- Salvataggi nel browser: Filesystem Capacitor su IndexedDB (db `Disc`, store `FileStorage`), non localStorage.

**Why:** l'utente trovava la UI da gestionale; vuole un gioco con carattere ma leggibile.
**How to apply:** ondata 3 (le altre schermate) parte solo dopo l'approvazione della prova su iPhone; ogni schermata usa solo token e classi esistenti. Vedi [[pixel-art-scene]].
