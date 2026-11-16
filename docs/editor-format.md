# Editor: modifiche e file delle correzioni

L'editor ("Redazione" nell'app, da Impostazioni) permette di cambiare, **per la carriera aperta**:

- nome, nome breve, iniziali, due colori e motivo della maglia dei club italiani e stranieri;
- nome e cognome dei calciatori delle rose, degli allenatori e dei procuratori (non del giocatore);
- il nome di campionati (`L1`…`L6`) e coppe (`national_cup`, `continental_major`, `continental_minor`).

Il gioco è distribuito solo con nomi inventati: non fornisce, non ospita e non collega file di
correzioni. Le correzioni restano sul dispositivo del giocatore.

## Come funzionano

- Motore: `packages/engine/src/world/edits.ts` (`editClub`, `editPerson`, `setCompetitionName`,
  `resetClub`, `resetPerson`, `resetAllEdits`, `pruneEdits`).
- Il mondo della carriera contiene i valori scelti; `GameState.edits` conserva i **valori generati
  in origine** di ogni club o persona modificati. Ripristinare un elemento rimette quei valori; se
  una modifica riporta un elemento all'origine, la voce sparisce. Senza modifiche `edits` non c'è.
- I nomi delle competizioni stanno nelle traduzioni: `edits.competitions` salva solo il nome nuovo e
  l'app lo mette al posto della traduzione (`I18nService.setOverrides`).
- I colori vanno scelti nella tavolozza di `content/data/clubs.json` (decisione dell'utente) e devono
  essere diversi tra loro. Le lunghezze massime stanno in `config/data/editor.json`.
- Contenuti e configurazione distribuiti con il gioco non cambiano mai.
- A fine stagione `pruneEdits` toglie le correzioni di calciatori ritirati.

## Formato del file (versione 1)

Schema Zod in `packages/app/src/app/core/editor/edits-file.ts`. Esempio (nomi inventati):

```json
{
  "format": "outstanding.edits",
  "version": 1,
  "seed": 11,
  "clubs": [
    {
      "id": "c17",
      "original": "Accademia Fulginate",
      "name": "Polisportiva Lampo",
      "shortName": "Lampo",
      "initials": "PL",
      "primary": "#F9C80E",
      "secondary": "#1A237E",
      "pattern": "vstripes"
    }
  ],
  "people": [
    { "id": "n251", "original": "Gualtiero Bassotti", "firstName": "Ettore", "lastName": "Fittizio" }
  ],
  "competitions": [{ "id": "L1", "name": "Lega delle Stelle" }]
}
```

| Campo                             | Regole                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| `format`                          | Sempre `outstanding.edits`                                          |
| `version`                         | Intero; un file più recente del gioco viene rifiutato               |
| `seed`                            | Facoltativo, solo informativo                                       |
| `clubs[].original`                | Nome del club **generato in origine**                               |
| `clubs[].primary` / `secondary`   | Esadecimale `#RRGGBB` della tavolozza, diversi tra loro             |
| `clubs[].pattern`                 | `solid`, `vstripes`, `hstripes`, `sash`                             |
| `people[].original`               | Nome e cognome originali separati da uno spazio                     |
| `competitions[].id`               | `L1`…`L6`, `national_cup`, `continental_major`, `continental_minor` |
| `clubs`, `people`, `competitions` | Facoltativi (lista vuota se mancano)                                |

Le lunghezze massime dei testi seguono `config/data/editor.json`; la dimensione massima del file è
`maxFileBytes`.

## Importazione

- Il file intero viene rifiutato se è troppo grande, non è JSON, non rispetta lo schema o ha una
  versione più recente.
- Ogni voce si applica solo se l'id esiste nella carriera **e** il nome originale coincide: un file
  di un'altra carriera (mondo generato con un altro seme) non rinomina club a caso. Le voci che non
  combaciano o che il motore non accetta vengono ignorate e contate.
- Le voci del file si sommano alle correzioni esistenti e, sugli stessi elementi, prevalgono.

## Esportazione

Sul telefono il file viene scritto nella cache dell'app e passato al menu di condivisione
(`@capacitor/share`); nel browser viene scaricato. Nome: `outstanding-modifiche-slotN.json`.
