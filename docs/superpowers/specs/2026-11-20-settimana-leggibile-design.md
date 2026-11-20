# Settimana leggibile: due binari, campo e vita

Data: 2026-11-20. Stato: bozza da approvare. Punto 3 della decisione "nucleo prima delle meccaniche
nuove" (`.ai/DECISIONS.md`, 2026-11-18). Solo design: il piano di implementazione è a parte.

## 1. Perché

Il giocatore non capisce cosa cambia scegliendo allenamento, riposo, svago, sponsor o famiglia.
L'utente vuole che ogni scelta abbia un effetto **chiaro, visibile e anticipato**, senza
aggiustamenti nascosti degli esiti. Orizzonte scelto dall'utente: **tutti e due**, cioè un effetto
immediato sulla prossima partita e un progresso di capitolo verso un traguardo visibile.

Lezione dai report (`reports/Meccaniche regista partita e stagione.md` §1,
`reports/Psicologia del giocatore e design.md` §7): prima il segnale, poi la scelta, poi il seguito
visibile; il feedback informativo (prima/dopo delle abilità) aumenta la motivazione, i premi opachi no.

## 2. Stato attuale e falle misurate

Il piano è di **2 azioni su 9** (`config/data/progression.json`), scelto a inizio capitolo e ripetuto
per 6–14 settimane (`season/fastForward.ts`, `repeatPlan`). Analisi del codice (mia e di
`ai-codex standard`) e sonda sul simulatore: 100 carriere per piano fisso, strategia prudente.

| Piano fisso per tutta la carriera | OVR max | % massima serie | % leggenda |
|---|---|---|---|
| allenamento + riposo (oggi) | 68,1 | 61 | 2 |
| intenso + riposo | 70,7 | 70 | 9 |
| intenso + normale | 69,8 | 64 | 0 |
| allenamento + niente | 63,6 | 28 | 0 |
| allenamento + famiglia | 63,8 | 28 | 0 |
| allenamento + serata | 63,6 | 28 | 0 |
| allenamento + svago | 57,1 | 0 | 0 |
| riposo + famiglia | 47,6 | 0 | 0 |
| svago + famiglia | 43,6 | 0 | 0 |
| niente + niente | 45,3 | 0 | 0 |

Falle da chiudere (gravità tra parentesi):

- F1 (alta) **Scelta dominante e tassa.** Intenso + riposo batte tutto; il riposo è obbligatorio.
  Energia di un titolare: allenamento −8, 90 minuti −22, recupero +10 → −20 a settimana senza riposo.
- F2 (alta) **Soglia nascosta a 30 di energia:** sotto, crescita ×0,6 e infortuni ×1,8 di colpo.
- F3 (alta) **Svago come trappola:** −1 disciplina a settimana senza ritorno; in carriera la disciplina
  va a zero e la crescita cala del 25% (fattore 0,75–1,25). Il testo non lo dice.
- F4 (alta) **Felicità mai letta:** né dagli esiti né dalle condizioni degli eventi. Famiglia ≈ niente,
  e non ferma il calo di affinità col partner (−0,6/−0,4 a settimana, `config/data/private.json`).
- F5 (alta) **Crescita che sparisce:** arrotondamento a 2 decimali dopo ogni seduta
  (`player/progression.ts`); a 27 anni un allenamento normale dà +0,00. Dopo i 30 anni allenarsi
  costa e non dà nulla.
- F6 (media) **Serata filtrata in silenzio** dal piano ripetuto (`repeatPlan` scarta `party`).
- F7 (media) **L'ordine delle azioni cambia l'esito** (riposo→allenamento lascia 8 di energia in meno).
- F8 (media) **Solo l'intenso** estrae infortuni in seduta; normale e mirato mai, anche a rischio 100.
- F9 (media) **Panchina senza contromisura:** nessuna azione mantiene la forma, che scende verso 38.
- F10 (media) **Fisioterapia preventiva inutile a regime;** stanchezza che non produce rotazione
  (chiusa dal Recupero automatico e dalla freschezza nella convocazione).
- F11 (media) **Nessun risultato a schermo:** i `gains` di `planWeek` non arrivano mai all'app.

## 3. Obiettivi, non obiettivi, anti-obiettivi

Obiettivi
- Ogni scelta del piano paga in una **valuta diversa** e ha un costo dichiarato: nessuna tassa,
  nessuna dominante.
- **Prima:** il piano mostra i numeri che il motore applicherà, con le stesse funzioni.
- **Dopo:** a ogni stop e a fine capitolo si vede cosa ha prodotto il piano.
- Pochi valori visibili, ognuno tradotto in campo.

Non obiettivi
- Ridisegnare eventi, finanze (M15), vita privata (M16) o media (M17).
- Cambiare il ritmo: il piano resta per capitolo.

Anti-obiettivi (fallimento anche se "funziona")
- Numeri mostrati diversi da quelli applicati, o ritocchi nascosti degli esiti.
- Una tabella di decimali che il giocatore deve interpretare.
- Un piano ottimo unico da ripetere per tutta la carriera.
- Stagione fuori 20–30 minuti o carriera fuori 6–8 ore.

## 4. Approcci considerati

- **A. Ritocco** delle 9 azioni (soglia lineare, deriva della disciplina, crescita senza perdite,
  serate nel piano). Costo basso, salvataggi invariati; resta una tabella di piccoli numeri.
- **B. Due binari, campo e vita (scelto dall'utente).** Carico a tre livelli + un'azione fuori dal
  campo, ciascuna con una valuta propria. Risolve insieme dominanza e leggibilità; costa motore,
  config, migrazione e nuova taratura.
- **C. Calendario a gettoni** settimanale stile Persona. Scartato: scelte ogni settimana, sfora i
  20–30 minuti a stagione e contraddice il piano a capitoli.

## 5. Il design

### 5.1 Il piano del capitolo

```ts
type Load = 'rest' | 'balanced' | 'push';          // Scarico, Equilibrio, Spinta
type LifeAction = 'family' | 'leisure' | 'sponsor' | 'party';
interface WeekPlan { load: Load; focus?: Skill; life?: LifeAction }
```

- Un carico obbligatorio, un focus facoltativo, un'azione fuori dal campo facoltativa.
- Il piano si ripete ogni settimana del capitolo, **senza filtri silenziosi**: se un'azione non è
  disponibile (sponsor senza contratti), il piano non si conferma e la UI lo dice.
- Da infortunato il carico è forzato a **Recupero** (vedi 5.3) e la UI lo mostra; la vita resta.
- Nessun ordine fra le scelte: gli effetti della settimana si sommano e poi si applicano una volta (F7).

### 5.2 Freschezza

Sostituisce energia e rischio infortuni con **un valore 0–100**, salvato nel campo esistente
`condition.energy` (etichetta UI "Freschezza"). `condition.injuryRisk` sparisce (migrazione 5.9).

- Variazione settimanale = `load.freshness` (comprende il recupero naturale) − `match.freshnessPer90`
  × quota di minuti giocati + effetti della vita e degli eventi. Tetto 0–100.
- Momenti in partita: `moments.freshnessWeight` (al posto di `energyWeight`), lineare.
- **Convocazione (decisione dell'utente, 2026-11-20):** la freschezza entra poco nel punteggio di
  selezione: sotto `selection.freshnessFrom` 60 il punteggio cala di `selection.freshnessWeight` 0,1 per
  punto (a 30 di freschezza −3, come un rumore). L'anteprima mostra anche il rischio panchina.
- **Infortuni** (partita e seduta): probabilità base × `injuries.freshnessCurve`, lineare e continua
  (F2, F8). Ogni carico ha una sua probabilità di seduta, anche Equilibrio (F8).
- Crescita: × `growth.freshnessFactor`, lineare fra un minimo a 0 e 1 a 100 (niente soglia).

### 5.3 Carico in campo

| | Freschezza/sett. | Crescita (sedute) | Infortunio in seduta | Forma da non giocare | Declino (31+) |
|---|---|---|---|---|---|
| Scarico | +32 | 0,3 | 0 | −2 | ×1,2 |
| Equilibrio | +22 | 1 | 0,002 | 0 | ×1 |
| Spinta | +12 | 1,5 | 0,008 | +1 | ×0,7 |
| Recupero (solo infortunati) | +28 | 0 | 0 | −2 | ×1 |

Per un titolare con 90 minuti (−22): Scarico ≈ +10, Equilibrio ≈ 0, Spinta ≈ −10 a settimana.

- **Tetto di freschezza per carico (decisione dell'utente, 2026-11-20):** Scarico 100, Equilibrio 90,
  Spinta 70 (`loads.*.freshnessCap`). Il clamp di fine settimana usa il tetto del carico: chi spinge
  non è mai al massimo, anche in panchina o dopo i 31 anni. Il tetto si vede sulla barra della freschezza.
Le sedute sono calibrate sul riferimento di oggi (allenamento + riposo = 1 seduta a settimana), per non
gonfiare la crescita media. Recupero: `healChance` 0,5 come la fisioterapia di oggi; la strategia prudente
la sceglie già sempre da infortunata, quindi la baseline non si sposta (da verificare nella baseline).

- **Focus:** manda `growth.focusShare` = 0,6 dei punti sull'abilità scelta, il resto sul ruolo
  come oggi, con il **totale dei punti invariato** meno `growth.focusLoss` 0,1 (il focus serve a
  scegliere dove crescere, non a crescere di più). Mai più il "solo focus" (×3) che svuota le altre.
- **Crescita senza perdite (F5):** nessun arrotondamento nello stato: abilità in virgola mobile piena,
  anche in crescita da partita, declino ed effetti degli eventi (si tolgono i `round2`). La UI mostra
  `floor` e la **barra** verso il prossimo +1 (la parte frazionaria), così numero e barra coincidono.
- **Ritmo:** la UI mostra "veloce / normale / lento / fermo" dal moltiplicatore di crescita, con il
  motivo principale (età, disciplina, freschezza). Il potenziale resta nascosto (CLAUDE.md §6).
- **Dopo i 30 anni (F5):** il carico sposta il declino di fine stagione (colonna Declino), **pesato
  sulle settimane** passate in ogni carico durante la stagione (contatore `season.loadWeeks` nello
  stato), così la Spinta del solo ultimo capitolo vale per le sue settimane. La UI mostra "declino −30%"
  invece della crescita. Mia scelta.
- **Panchina (F9):** chi non gioca usa "Forma da non giocare" del carico invece di −2 fisso.

### 5.4 Fuori dal campo

Ogni azione compra una cosa che nessun'altra dà. Gli effetti sono **modificatori del capitolo** attivi
finché l'azione è nel piano, non valori nascosti che si accumulano.

| Azione | Cosa compra | Costo dichiarato |
|---|---|---|
| Famiglia | i cali di morale (sconfitta, panchina, fuori rosa, infortunio, obiettivo mancato) × `moraleLossFactor` 0,5; l'affinità col partner non cala (deriva × 0) | nessuno; non è disponibile come "relazione" senza partner, ma il morale protetto vale sempre |
| Svago | sotto il valore di riferimento il morale risale × `moraleRecoveryFactor` 2 (deriva da 10% a 20% della distanza a settimana) | nessuno |
| Sponsor | soldi: somma degli ingaggi sponsor × `sponsorWeeksPerWeek` 0,5 a settimana | freschezza −4 a settimana; serve almeno uno sponsor |
| Serata | popolarità +0,5 a settimana | disciplina −1 a settimana; affinità col partner −2 a settimana; giornali `gossipChance` 0,05 a settimana (reputazione −3, popolarità +2, affinità −6); multa `fineChance` 0,1 nelle settimane con partita (multa come oggi, rapporto con l'allenatore −6). Tutti i costi scritti nella scheda |

- La disciplina (F3) **torna verso il suo valore di base** `persona.disciplineBase` del 5% della distanza
  a settimana (`discipline.driftPerWeek` 0,05, come `toward()` per morale e forma): la Serata fissa si
  stabilizza circa 20 sotto la base, non a zero. Nel piano la abbassa solo la Serata. Gli effetti degli
  **eventi** e dei tratti muovono valore e base insieme (cambio di carattere permanente, il senso dei
  43 effetti di oggi resta); la Serata muove solo il valore. Visibile nel profilo. Mia scelta.
- La UI della Serata mostra la probabilità **del capitolo**, calcolata esatta:
  `1 − (1 − p)^settimane` ("circa 1 su 2 di finire sui giornali in 14 settimane").
- **Felicità:** il piano non la scrive più. Resta per eventi, stile di vita e vita privata; il suo
  ruolo meccanico è un **punto aperto** per M16 (oggi nessuno la legge, F4).

### 5.4b Aritmetica della settimana (mia scelta)

Ordine fisso in `advanceWeek`, uguale in `planWeek`, nel salto rapido e in `previewPlan`:

1. **Freschezza di inizio settimana** F₀: è il valore che leggono la crescita della settimana
   (`freshnessFactor`), la partita (momenti, infortuni) e gli eventi.
2. Sedute del carico: crescita con F₀, estrazione d'infortunio in seduta con F₀.
3. Eventi della settimana, poi partita (se c'è): usano F₀ più gli effetti degli eventi già applicati.
4. Fine settimana: F₁ = clamp(F₀ + carico + vita + partita + eventi, 0, tetto del carico), **un solo clamp**.

Così l'ordine fra piano e partita non conta e "freschezza alle partite" nell'anteprima è F₀ della
settimana della partita. Nessun arrotondamento nello stato (5.3).

### 5.5 Anteprima (prima)

Nuova funzione pura del motore, la sola fonte dei numeri del piano:

```ts
previewPlan(state, plan, ctx): PlanPreview
```

- **Esatto per settimana:** variazioni di freschezza, crescita attesa per abilità, effetti della vita.
  La crescita è deterministica, quindi esatta.
- **Proiezione del capitolo:** freschezza attesa alle partite del capitolo nell'ipotesi "titolare
  90 minuti" (scritta in UI), probabilità d'infortunio del capitolo, settimane al prossimo +1
  dell'abilità focus (o della più vicina), soldi e popolarità dalla vita, probabilità di giornali.
- Per la traduzione in campo: % nei momenti alla freschezza attesa (da `moments.freshnessWeight`),
  rischio "basso / medio / alto" con soglie in config.
- `planWeek` e `previewPlan` usano le stesse funzioni di calcolo; un test confronta l'anteprima con
  l'esito vero su seed fissi (parte deterministica uguale al centesimo).

### 5.6 Risultato (dopo)

- **Registro del piano** nel registro del tratto (`chapter.stretch`, aggiunte facoltative): abilità a
  inizio tratto, freschezza alle partite, volte in cui il morale è stato protetto, soldi sponsor,
  popolarità, giornali, interi guadagnati.
- **Home, scheda capitolo:** riga "Dal piano" dall'ultimo stop ("Tiro 61 → 62 · freschezza 74 → 66 ·
  morale protetto 2 volte").
- **Fine capitolo:** sul foglio della prima pagina, blocco prima/dopo e un suggerimento neutro tratto
  dai numeri ("Sei arrivato stanco a 3 partite su 9"). Mai una scelta imposta.

### 5.7 Interfaccia

Si usano `frontend-design`, `game-ui-ux` e i token di `docs/design-system.md`. Testi in `it.ui.json`.

```
PIANO · AUTUNNO · 14 settimane, 9 partite
IN CAMPO
 [Scarico]  [■ Equilibrio]  [Spinta]        Focus: [Tiro ▾]
 Freschezza alle partite  ▮▮▮▮▮▮▮▯▯▯  ~70 → momenti +2%   (se titolare)
 Rischio infortuni        basso
 Tiro 61 ▮▮▮▮▮▮▯▯▯▯ 62    +1 tra ~3 settimane · Ritmo: veloce (18 anni)
FUORI DAL CAMPO
 [■ Famiglia] [Svago] [Sponsor] [Serata] [Nessuna]
 Morale protetto: sconfitte e panchine pesano la metà
                                   [ Conferma piano e vai ]
```

- Il piano a tutta scheda solo quando va scelto, come oggi (`needsPlan`).
- Cambiando scelta i numeri si aggiornano con un'animazione di 150–250 ms; `prefers-reduced-motion`
  la toglie.
- **Juice solo sul +1** di un'abilità (`game-feel`): un lampo sulla barra e un suono zzfx breve,
  una volta per abilità per stop. Menu sobri.
- Bersagli al tocco da 44 px in su, contrasto AA, lettori di schermo: ogni scelta annuncia il suo
  effetto principale.

### 5.8 Parametri in config (ipotesi, da tarare col simulatore)

`config/data/progression.json` sostituisce `actionsPerWeek`, `actions` e `skipWeekPlan` con:

```json
{
  "loads": {
    "rest":     { "freshnessCap": 100, "freshness": 32, "sessions": 0.3, "sessionInjury": 0,     "formNotPlaying": -2, "decline": 1.2 },
    "balanced": { "freshnessCap": 90,  "freshness": 22, "sessions": 1,   "sessionInjury": 0.002, "formNotPlaying": 0,  "decline": 1 },
    "push":     { "freshnessCap": 70,  "freshness": 12, "sessions": 1.5, "sessionInjury": 0.008, "formNotPlaying": 1,  "decline": 0.7 },
    "recovery": { "freshnessCap": 100, "freshness": 28, "sessions": 0,   "sessionInjury": 0,     "formNotPlaying": -2, "decline": 1, "healChance": 0.5 }
  },
  "life": {
    "family":  { "moraleLossFactor": 0.5, "affinityDriftFactor": 0 },
    "leisure": { "moraleRecoveryFactor": 2 },
    "sponsor": { "sponsorWeeksPerWeek": 0.5, "freshness": -4 },
    "party":   { "popularity": 0.5, "discipline": -1, "partnerAffinity": -2, "gossipChance": 0.05, "fineChance": 0.1 }
  },
  "skipWeekPlan": { "load": "balanced" },
  "growth": { "focusShare": 0.6, "focusLoss": 0.1, "freshnessFactor": { "atZero": 0.6 } },
  "discipline": { "driftPerWeek": 0.05 },
  "condition": { "freshnessPer90": 22 },
  "events": { "riskToFreshness": 1.7 },
  "injuries": { "freshnessCurve": { "at100": 0.6, "at0": 2 } },
  "preview": { "riskBands": { "medium": 0.15, "high": 0.3 } }
}
```

`config/data/match.json`: `moments.freshnessWeight` 0,06 al posto di `energyWeight`;
`selection.freshnessFrom` 60 e `selection.freshnessWeight` 0,1.
Restano invariati `basePerSession`, età, potenziale, `disciplineFactor`, `injuries.types`.

### 5.9 Salvataggi e contenuti

- `saveVersion` 4 con migrazione da 3:
  - `chapterPlan` / `lastPlan` → `WeekPlan`: `train_intense` → push, `train_normal`/`train_focus`
    → balanced (con il focus), solo `rest`/`physio` → rest; prima azione fra family, leisure,
    sponsor, party → `life`.
  - `condition.injuryRisk` eliminato; `condition.energy` resta come freschezza.
  - `persona.disciplineBase` = massimo fra valore attuale e valore medio di creazione da config, per
    non congelare il danno di F3;
  - piani senza allenamento (es. svago + serata) → Equilibrio con quella vita; piani vuoti → `skipWeekPlan`;
  - la Serata dei vecchi piani entra davvero nel piano migrato (oggi era filtrata): cambio voluto, nel CHANGELOG;
  - `season.loadWeeks` inizializzato a zero; catena v1→v2→v3→v4 preservata, nessun effetto riapplicato.
- Eventi: gli 8 effetti su `condition.injuryRisk` diventano effetti su `condition.energy` con segno
  opposto e fattore `riskToFreshness` 1,7 (rischio +3 → freschezza −5, per conservare l'effetto sugli
  infortuni); stessa conversione per le condizioni degli eventi e per `effectScore` del simulatore.
  Il validatore rifiuta il percorso `condition.injuryRisk`.
  I 48 su `condition.energy` restano e valgono come freschezza.
- Testi: le chiavi `week.actions.*` lasciano il posto a `week.load.*` e `week.life.*`, con il costo
  scritto in ogni descrizione.

### 5.10 Simulatore

- Strategie: `cautious` = Equilibrio + Famiglia; `aggressive` = Spinta + focus + Serata (Scarico
  sotto 35 di freschezza); `random` = carico e vita a caso; `contextual` = regola adattiva (Scarico
  prima di un capitolo con partite di peso o sotto 50, Spinta con freschezza alta e capitolo leggero,
  Svago con morale sotto 50, Famiglia altrimenti, Sponsor con poca liquidità).
- Opzione nuova `--plan load+life` per ripetere un piano fisso (rifà la sonda della §2).
- **Criteri da rispettare** (oltre a stagione 20–30 minuti e carriera 6–8 ore con la strategia
  di riferimento attuale):
  1. nessun piano fisso supera `contextual` in punteggio medio di carriera;
  2. Spinta fissa per tutta la carriera ≤ 95% del punteggio di `contextual`;
  3. Scarico fisso e "nessuna vita" sono peggiori di Equilibrio, ma non sotto il 50% (non trappole);
  4. ogni azione della vita è la migliore in almeno uno scenario misurato da un test mirato
     (morale basso dopo sconfitte, partner in crisi, cassa vuota, popolarità per un'offerta);
  5. le metriche di §9 di CLAUDE.md restano vicine alla baseline (massima serie, leggende rare).
- **Baseline (mia scelta):** prima di toccare il codice si registrano 5000 carriere, seed 42, con
  `cautious` e `contextual` sul codice di oggi (stato B3b, non A0) in `reports/`. "Vicino" = entro ±10%
  su % massima serie, OVR massimo e presenze; leggende fra 1% e 5%. Il punteggio dei criteri 1–3 è
  `score.total` di `CareerResult`.
- **Confronti a parità (mia scelta):** i piani fissi (`--plan`) usano la stessa logica di momenti,
  offerte ed eventi di `contextual`, così vince o perde solo il piano. Le regole del piano di
  `contextual` si fissano prima della taratura e non si ritoccano per farla vincere.
- La strategia di riferimento per i tempi (20–30 minuti) è la nuova `cautious`; oggi si è al bordo
  basso (circa 20 minuti), quindi il tempo dell'anteprima va contato in `secondsPer`.

## 6. Cosa resta al costruttore

- I numeri della §5.8 sono ipotesi: tararli col simulatore e annotare il confronto.
- Forma esatta di `PlanPreview`, dell'aggiunta al registro del tratto e dei testi.
- Come la UI tratta il piano non confermabile e il carico forzato da infortunato.
- Regole fini della strategia `contextual`, purché i criteri della §5.10 siano misurabili.

## 7. Punti aperti

- Ruolo meccanico della felicità (M16).
- Se la disciplina visibile entra fra gli obiettivi di capitolo.
