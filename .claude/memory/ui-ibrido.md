---
name: ui-ibrido
description: Interfaccia ibrida giornale + pixel (2026-11-17): regole fisse e dove stanno; ondate 1-3 fatte (ondata 3 chiusa il 2026-11-20)
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
- Ondata 3 (2026-11-20): tutte le schermate restanti. La cornice dell'avatar sta nel componente
  (`ui/avatar.component.ts`), quella delle vignette in `ui/vignette.component.ts`: non rifarla nelle pagine.
  Pulsante secondario sulla carta: `.o-btn.o-px--paper`. Icone pixel nuove: `heart` (test conta 14 icone).
- Verifica visiva: script Playwright che crea una carriera da `ng.getComponent(app-start).game`, gioca
  stagioni e fotografa le rotte in scuro e chiaro (dev server sulla porta 4300).

**Why:** l'utente trovava la UI da gestionale; vuole un gioco con carattere ma leggibile.
**How to apply:** nuove schermate solo con token e classi esistenti; niente angoli tondi, numeri da 20 px in `.o-num`. Vedi [[pixel-art-scene]].
