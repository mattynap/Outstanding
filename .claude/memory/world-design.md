---
name: world-design
description: Struttura della piramide fittizia, nomi dei club, scelte e limiti noti del mondo
metadata:
  type: project
---

- 6 livelli, i livelli 3–6 hanno 3 gironi per area N/C/S (Sardegna in C). Promozioni/retrocessioni
  per girone in `config/world.json`, validate (rel. livello n = prom. livello n+1).
- Nomi delle leghe e coppe solo nelle traduzioni (`leagues.<level>.name`, `competitions.<id>.name`):
  Serie Oro/Argento/Bronzo, Lega Interzonale, Regionale Maggiore/Minore, Coppa Tricolore,
  Coppa Europa Maior/Minor. Evitati nomi storici reali (Prima/Seconda Divisione, Interregionale, Eccellenza).
- Nomi dei club = prefisso (`content/data/clubs.json`) + epiteto della città; mai "<città> Calcio"
  o simili (alto rischio di coincidere con club reali). Epiteti ripuliti da nomi di club reali.
- Rating del club = media dei migliori 11 della rosa: risulta ~4 punti sopra `ratingRange`.
- Salvataggio iniziale ~600 KB (rose + calendario): da comprimere/ottimizzare in M10.
- Coppe: definite nel mondo ma non giocate; da pianificare (chiedere all'utente in quale milestone).

Collegato: [[engine-design]]
