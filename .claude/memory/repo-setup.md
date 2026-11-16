---
name: repo-setup
description: Remote git reale, memoria locale corretta, PDF del documento di progetto non versionato
metadata:
  type: project
---

- Il remote `origin` è **GitHub** (github.com/mattynap/Outstanding), non Bitbucket come dice CLAUDE.md.
  Si fa push su `origin dev` (vedi [[feedback-git-branch-and-comments]]).
- 2026-11-16: `.claude/settings.local.json` aveva `autoMemoryDirectory` con un percorso segnaposto;
  corretto in `C:/Users/User/Desktop/git/Outstanding/.claude/memory`.
- Il PDF "Documento di progetto – Gioco carriera calciatore.pdf" nella radice **non** è versionato
  (contiene dati personali dell'autore); la sintesi è in `docs/design/README.md`. Chiedere all'utente
  se vuole versionarlo o ignorarlo.

Collegato: [[tooling]]
