---
name: feedback-git-branch-and-comments
description: Push solo sul branch dev (non main) e commenti nel codice in italiano
metadata:
  type: feedback
---

- Dal 2026-11-16 commit e push vanno sul branch **`dev`** (creato da `main`), non su `main`.
  `main` si aggiorna solo se l'utente lo chiede.
- I **commenti nel codice** vanno scritti in **italiano** (identificatori restano in inglese).
  I commenti già scritti in inglese sono stati tradotti.

**Why:** richiesta esplicita dell'utente; aggiornato anche CLAUDE.md (sezione 1) che prima diceva commenti in inglese e remote Bitbucket.

**How to apply:** `git push origin dev`; nuovi commenti, JSDoc e descrizioni nei test in italiano.

Collegato: [[repo-setup]]
