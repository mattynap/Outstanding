---
name: repo-setup
description: Remote git reale, memoria locale corretta, PDF del documento di progetto versionato
metadata:
  type: project
---

- Il remote `origin` è **GitHub** (github.com/mattynap/Outstanding), non Bitbucket come dice CLAUDE.md.
  Si fa push su `origin dev` (vedi [[feedback-git-branch-and-comments]]).
- 2026-11-16: `.claude/settings.local.json` aveva `autoMemoryDirectory` con un percorso segnaposto;
  corretto in `C:/Users/User/Desktop/git/Outstanding/.claude/memory`.
- Il PDF "Documento di progetto – Gioco carriera calciatore.pdf" nella radice è **versionato**
  (decisione dell'utente del 2026-11-16); la sintesi è in `docs/design/README.md`.

Collegato: [[tooling]]

- Dal 2026-11-17: il remote `mattynap/Outstanding` accetta scritture solo dall'account GitHub
  `mattynap`; `locodev13-prog` ha solo lettura (errore 403). Prima di pubblicare:
  `gh auth switch -u mattynap`. Il branch remoto di Ciro è `origin/ciro-dev`.
