---
name: editor-design
description: Decisioni dell'editor M11b (ambito per carriera, tavolozza, valori originali, formato file)
metadata:
  type: project
---

- Decisioni utente (2026-11-16): correzioni **per carriera** (non globali sul dispositivo) e colori
  **solo dalla tavolozza** di `content/data/clubs.json` (14 colori) più il motivo della maglia.
- Implementazione: il mondo contiene i valori modificati; `GameState.edits` conserva i valori
  **originali** (club: nome/breve/iniziali/colori/motivo; persone: nome) e i nomi nuovi delle
  competizioni. Scelto così perché il motore scrive nomi nei resoconti (marcatori, avversari,
  `clubName` delle offerte): con un livello sovrapposto solo in visualizzazione sarebbero rimasti i
  nomi vecchi. Contenuti e config non cambiano mai.
- Nomi delle competizioni: solo in `edits.competitions`, applicati dall'app sopra le traduzioni
  (`I18nService.setOverrides`, pipe `t` non pura).
- Il file esportato porta il nome **originale** di ogni voce: all'importazione si applica solo se
  id e nome originale combaciano (gli id `cN` esistono in ogni mondo, quindi l'id da solo non basta).
- Escluso dall'editor il giocatore stesso (non richiesto).
- Formato e regole: `docs/editor-format.md`.

Collegato: [[app-design]], [[progress]], [[world-design]]
