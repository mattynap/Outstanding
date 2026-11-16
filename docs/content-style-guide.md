# Guida di stile dei contenuti

Come si scrivono gli eventi e gli altri testi del gioco.

## Tono

- Realistico e ironico, mai volgare.
- Frasi brevi. Lessico calcistico italiano (pagella, mister, spogliatoio, piazza, ritiro, mercato).
- Seconda persona per il giocatore ("Apri il borsone..."), presente indicativo.
- **Nessuna scelta sempre giusta:** ogni opzione ha un costo (energia, soldi, rapporti, immagine).
  Se una scelta non costa nulla, deve anche rendere poco.
- Temi delicati (dipendenze, scommesse, violenza) solo come conseguenze negative, mai premiati.
  Niente meccaniche di azzardo, nemmeno raccontate come gioco.

## Nomi

- Città italiane vere, ma club, persone, leghe, coppe e marchi **inventati**.
- Mai nomi reali, nemmeno come esempio o in un test.

## Testi

- Tutti i testi visibili stanno nei file di traduzione in `packages/content/data/i18n/`:
  `it.json` (interfaccia, partita) e `it.events.json` (eventi). Una chiave non può comparire in
  due file.
- Segnaposto ammessi negli eventi: `{firstName}`, `{lastName}`, `{club}`, `{coach}`, `{agent}`,
  `{city}` (città del club, o quella natale se senza squadra), `{hometown}`, `{business}`
  (richiede la condizione `business: true`), `{partner}` (richiede una condizione
  `relationship` diversa da `single`), `{child}` (richiede `children: true`).
  `{club}` e `{coach}` solo nelle categorie che richiedono una squadra o con una condizione che la
  garantisce (`level`, `professional`, `coachRelationship`). `{agent}` per ora non va usato:
  nessuna condizione garantisce che il procuratore ci sia.
- Testi dell'interfaccia con un numero: singolare e plurale con `{n|offerta|offerte}`.
- **Titolo** in stile prima pagina: massimo 8 parole, senza punto finale.
- **Testo:** 1–3 frasi, massimo circa 200 caratteri.
- **Scelte:** frasi all'infinito o alla seconda persona, massimo 6–7 parole ("Resti a casa").
- Gli eventi frequenti (peso ≥ 3 o cooldown ≤ 12 settimane) hanno 2–3 varianti di testo.

## Formato degli eventi

Un file JSON con un array di eventi per argomento, in `packages/content/data/events/<categoria>/`.
Un nuovo file va registrato in `packages/content/src/eventFiles.ts`; aggiungere eventi a un file
esistente non richiede codice.

```json
{
  "id": "mister_colloquio_01",
  "category": "dressing_room",
  "weight": 2,
  "cooldownWeeks": 30,
  "conditions": { "age": { "max": 23 } },
  "titleKey": "events.mister_colloquio_01.title",
  "textKey": "events.mister_colloquio_01.text",
  "textVariants": 2,
  "choices": [{ "textKey": "events.mister_colloquio_01.c1", "effects": [] }]
}
```

- `id`: `<argomento>_<descrizione>_<nn>`, minuscolo con underscore.
- `category`: `dressing_room`, `training`, `media`, `life`, `family`, `transfer`, `business`,
  `love`. Le categorie
  `dressing_room`, `training` e `transfer` richiedono che il giocatore abbia una squadra.
- `weight`: peso nell'estrazione casuale (1 raro, 3 frequente).
- `cooldownWeeks`: settimane prima che l'evento possa tornare. `once: true` = una volta per carriera.
- `chainOnly: true`: l'evento non viene mai estratto a caso, arriva solo tramite `schedule`.
- `textVariants`: con più varianti le chiavi sono `<textKey>.1`, `<textKey>.2`, ...
- `choices`: da 1 a 4 scelte, ognuna con i suoi effetti.

### Condizioni

`age`, `level`, `seasonWeek`, `coachRelationship` (intervalli `{ "min", "max" }`), `stats`
(`[{ "path", "gte", "lte" }]`), `window` (`summer`, `winter`, `closed`), `flags`, `flagsNot`,
`roles`, `traits`, `traitsNot`, `professional`, `injured`, `business` (ha un'attività),
`relationship` (`single`, `partner`, `dating`, `engaged`, `married`), `affinity` (intervallo, solo
con partner), `children`, `affair`.

`trigger` (`affairDiscovered`, `childBorn`, `partnerLeft`) insieme a `chainOnly`: l'evento arriva
quando il motore registra quel fatto della vita privata.

### Effetti

| Tipo            | Campi                                              | Note                                                            |
| --------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `stat`          | `path`, `delta`                                    | Percentuali limitate a 0–100; follower e stipendio mai negativi |
| `money`         | `delta`                                            | Soldi in cassa (possono andare in negativo)                     |
| `flag`          | `flag`, `value`                                    | `value` predefinito `true`; `null` rimuove il flag              |
| `relationship`  | `target` (`coach`, `agent`), `delta`               | Rapporto da -100 a 100                                          |
| `schedule`      | `eventId`, `inWeeks`                               | Catene di eventi                                                |
| `startTransfer` | `to` (`higher_level`, `same_level`, `lower_level`) | Richiesta per il mercato (M7)                                   |
| `injury`        | `injuryType`, `weeks` `[min, max]`                 |                                                                 |
| `trait`         | `traitId`, `action` (`add`, `remove`)              |                                                                 |
| `chance`        | `p`, `effects`, `otherwise`                        | Esito incerto: rende le scelte meno prevedibili                 |
| `business`      | `health`                                           | Andamento dell'attività principale                              |
| `partner`       | `affinity`                                         | Intesa con il partner (nessun effetto da single)                |
| `meet`          | —                                                  | Si conosce qualcuno (solo da single)                            |
| `affair`        | `action` (`start`, `end`)                          | Storia segreta (iniziarla richiede un partner)                  |
| `breakup`       | —                                                  | Fine della relazione, con le regole della separazione           |

Percorsi validi per `stat`: `condition.*` (form, energy, morale, injuryRisk), `persona.*`
(discipline, temperament, happiness), `image.*` (popularity, reputation, followers), `money.*`
(cash, salaryWeekly, assets), `skills.*`.

### Ordini di grandezza

- Statistiche di umore e immagine: ±1–6 per un evento normale, fino a ±10 per uno raro.
- Abilità: al massimo +1 per evento (la crescita vera arriva dall'allenamento).
- Intesa con il partner: ±2–10.
- Energia: −3/−15 per serate e sforzi extra.
- Soldi: in proporzione allo stipendio (dilettanti 30–180 a settimana). Spese grosse solo con una
  condizione che le renda sostenibili (`money.cash`, `professional`, `level`, `business`).

## Varietà

- Prima di scrivere un evento, controllare che il tema non ci sia già (`it.events.json`).
- Il numero di notizie a settimana non cambia con il numero di eventi (`config/events.json`): più
  eventi significano più varietà, non più tempo di gioco.

## Controllo

`pnpm content:check` verifica schema, chiavi di testo, segnaposto, catene (eventi esistenti e mai
orfani), tratti citati e id duplicati. Gira anche nei test.
