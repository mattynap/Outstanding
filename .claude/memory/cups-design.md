---
name: cups-design
description: "Decisioni dell'utente e scelte di implementazione per le coppe (M7b)"
metadata:
  node_type: memory
  type: project
  originSessionId: ba3e7028-a690-4902-a1e6-0b641b622f63
  modified: 2026-11-16T08:16:28.565Z
---

Decisioni dell'utente (2026-11-16):
- Coppe europee contro **club stranieri inventati**: città europee reali, nomi dei club inventati,
  stemma/maglia/rosa e nomi dei giocatori stranieri. Riutilizzabili in futuro per l'estero.
- Formato europee: **gironi + eliminazione** (8 gironi da 4, 6 giornate; ottavi, quarti, semifinali
  andata/ritorno; finale secca in campo neutro).
- Qualifica: 1ª–4ª della massima serie in Coppa Europa Maior, 5ª–6ª e vincitrice della Coppa
  Tricolore in Minor (se già qualificata, scala la successiva). Prima stagione: per forza dei club.
- Coppa Tricolore: 100 professionisti + le 28 più forti della Lega Interzonale (livello 4),
  gare secche con supplementari e rigori, le squadre più forti entrano nei turni successivi.

Scelte implementative (prese da me):
- Club stranieri in `world.foreignClubs` (non in `world.clubs`, così mercato e piramide non li vedono).
- Partite di coppa nel calendario con `fixture.cup`; più partite nella stessa settimana
  (infrasettimanale); `playerFixture` restituisce la prossima partita **non giocata** della settimana.
- Trofei del giocatore in `SeasonRecord.trophies` (id del campionato vinto o della coppa).

Collegato: [[world-design]], [[progress]]
