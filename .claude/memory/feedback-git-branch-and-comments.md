---
name: feedback-git-branch-and-comments
description: Lavoro di Ciro sul branch ciro-dev (dev è di Mario), mai main; commenti nel codice in italiano
metadata:
  type: feedback
---

- Dal 2026-11-16 commit e push vanno sul branch **`dev`** (creato da `main`), non su `main`.
  `main` si aggiorna solo se l'utente lo chiede.
- I **commenti nel codice** vanno scritti in **italiano** (identificatori restano in inglese).
  I commenti già scritti in inglese sono stati tradotti (le descrizioni dei test `it(...)` restano in inglese: sono stringhe, non commenti).

**Why:** richiesta esplicita dell'utente; aggiornato anche CLAUDE.md (sezione 1) che prima diceva commenti in inglese e remote Bitbucket.

- Dal 2026-11-17 il lavoro di Ciro va sul branch **`ciro-dev`**: `dev` contiene il lavoro di Mario
  e non si tocca (nessun commit, nessun invio). Il `dev` locale segue `origin/dev`.

**How to apply:** invio su `origin ciro-dev`, solo con conferma dell'utente; nuovi commenti e JSDoc in italiano.

- Nei commit aggiungere **percorsi espliciti**, non `git add -A`: l'utente può creare file suoi
  nel repo (es. `docs/TODO.txt`, finito per errore nel commit di M7 il 2026-11-16).

Collegato: [[repo-setup]]
