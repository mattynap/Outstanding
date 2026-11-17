---
name: pixel-art-scene
description: Scene Phaser in pixel art generata dal codice, approvata dall'utente il 2026-11-17
metadata:
  type: project
---

Le scene animate (campo e sala stampa) sono pixel art disegnata dal codice, stile Vampire Survivors.
Approvata dall'utente il 2026-11-17 dopo prova su iPhone. Design: `docs/superpowers/specs/2026-11-17-pixel-art-scene-design.md`.

**Why:** la versione a rettangoli era giudicata "orrenda, molto scarna".
**How to apply:** nuove scene usano `Pix`, `ensurePlayer`/`ensureBust` e `director`; niente asset
esterni; verificare con screenshot di Chrome headless (rAF sostituito da setTimeout) prima di
installare su iPhone. Collegato a [[pop-culture-italiana]].
