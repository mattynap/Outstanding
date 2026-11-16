# CLAUDE.md — Gioco carriera calciatore

Questo file è la guida per sviluppare il progetto. Leggilo tutto all'inizio di ogni sessione.
Documento di progetto completo (visione, meccaniche, roadmap): https://claude.ai/artifact/G3VmFiohmkXimkvw1edhy3
Una copia sintetica delle decisioni sta in `docs/design/` (vedi sotto); se c'è conflitto, vale questo file.

---

## 1. Regole di lavoro (obbligatorie)

### Git: niente riferimenti a Claude o all'AI
- Nei messaggi di commit, nelle descrizioni delle pull request, nei nomi dei branch, nei commenti del codice e nella documentazione **non** inserire riferimenti a Claude, Anthropic, AI o assistenti.
- **Nessuna** riga `Co-Authored-By`, nessun `Generated with ...`, nessun `Claude-Session`, nessun link a sessioni.
- Messaggi di commit in italiano, formato Conventional Commits: `feat(engine): aggiungi calcolo voto in pagella`, `fix(app): ...`, `content: ...`, `test: ...`, `docs: ...`, `chore: ...`.
- Commit piccoli e coerenti, uno per argomento. Non fare commit di codice che non compila o con test rotti.
- Repository remoto: GitHub (`origin`). Puoi fare commit e push in autonomia; mai force push né riscrittura della storia già pubblicata.
- **Branch di lavoro: `dev`** (creato da `main`). Commit e push vanno su `dev`; `main` si aggiorna solo su richiesta dell'utente.

### Autonomia nel terminale
- **Non chiedere conferma** per i comandi da terminale: installazioni (`pnpm`, `npm`, `npx`), operazioni git (status, add, commit, branch, merge, push), build, test, generatori. Procedi e poi riassumi cosa hai fatto.
- I permessi sono già concessi in `.claude/settings.json`; restano bloccati solo i comandi distruttivi elencati lì (force push, reset --hard, rm -rf su percorsi di sistema, sudo, lettura di `.env`).
- Fermati e chiedi solo se un'operazione cancellerebbe lavoro non salvato o dati dell'utente, o se tocca file fuori dal repository.

### Memoria del progetto: dentro il repository, versionata
- Tutte le note di memoria del progetto vanno in **`.claude/memory/`** dentro questo repository (indice: `.claude/memory/MEMORY.md`), **non** in `~/.claude/projects/...`.
- `.claude/memory/` **deve essere versionata in git**: non aggiungerla mai a `.gitignore`.
- Quando impari qualcosa di stabile sul progetto (una decisione, un vincolo, un problema risolto, una preferenza dell'utente), annotalo lì in un file per argomento e aggiorna l'indice.
- Non usare `CLAUDE.local.md`: le istruzioni condivise stanno in questo file, le note in `.claude/memory/`.
- Nota tecnica: la cartella di memoria automatica si sposta con `autoMemoryDirectory` in `.claude/settings.local.json` (percorso assoluto, vedi sezione 12). Se a inizio sessione vedi che la memoria punta ancora alla cartella utente, segnalalo all'utente e continua comunque a scrivere le note in `.claude/memory/`.

### Modo di lavorare
- Lavora **una milestone alla volta** (sezione 11), nell'ordine indicato. A fine milestone: test verdi, breve riepilogo all'utente, aggiornamento di `CHANGELOG.md` e della memoria.
- Puoi aggiungere le dipendenze che servono senza chiedere: preferisci librerie mantenute e con licenza permissiva (MIT, Apache, BSD), e annota in `.claude/memory/` perché le hai scelte.
- Non inventare requisiti: se una meccanica non è definita qui o nel documento di progetto, proponi 2 opzioni e chiedi.
- Lingua: codice e nomi di variabili in **inglese**; commenti nel codice in **italiano**; testi visibili al giocatore in **italiano** (tramite file di traduzione); documentazione e commit in **italiano**.

---

## 2. Il progetto in breve

Gioco mobile (Android, poi iOS) che simula la carriera di un calciatore italiano **in campo e fuori**: dai 16 anni nei dilettanti fino al ritiro.
- **Fase 1:** versione testuale (interfaccia a schede, testi, scelte, statistiche).
- **Fase 2:** versione 2D (momenti chiave animati, scene illustrate), che riusa lo stesso motore.
- Obiettivo: gioco completo e curato, **rivendibile** come asset (codice pulito, documentato, contenuti separati dal codice).
- Il giocatore controlla **una persona**, non un club. Sessioni brevi (5–15 minuti).

### Vincoli non negoziabili
- **Nessun nome reale scritto esatto**: club, giocatori, campionati e coppe usano **nomi storpiati** (riconoscibili ma alterati, es. "Erlin Holland") o inventati. Sponsor e marchi commerciali restano solo inventati. Città italiane vere sì. Decisione dell'utente del 2026-11-17, che accetta il rischio legale (vedi `.claude/memory/naming-policy.md`).
- **Niente gioco d'azzardo**: nessuna meccanica di casinò o scommessa, nessuna cassa premio casuale a pagamento.
- **Nessun "pay to win"**: gli acquisti non comprano progressione.
- Gioco **offline**: salvataggi locali, nessun server obbligatorio.

### Nomi reali ed editor
- Il gioco viene distribuito con **nomi storpiati o inventati**, mai con nomi reali scritti esatti. Nel repository, negli asset, nei testi, negli screenshot e nei materiali promozionali non devono comparire stemmi, loghi, maglie o volti reali, né copie riconoscibili di essi: stemmi, maglie e avatar restano generati dal codice.
- È previsto un **editor** con cui il giocatore può rinominare club, giocatori e competizioni, cambiarne i colori ed esportare/importare le proprie modifiche come file JSON. Le personalizzazioni restano sul dispositivo dell'utente.
- Il formato del file dell'editor è documentato e validato (Zod), ma **non** si forniscono, ospitano o linkano file con nomi reali esatti.
- I nomi reali dei calciatori potranno arrivare solo in futuro, tramite licenza FIFPRO e su decisione esplicita dell'utente.

---

## 3. Stack tecnico

| Parte | Tecnologia |
|---|---|
| Linguaggio | TypeScript (strict) ovunque |
| Monorepo | pnpm workspaces |
| Motore di gioco | TypeScript puro, **zero dipendenze UI** |
| App fase 1 | Angular (ultima versione stabile) + Ionic + Capacitor |
| App fase 2 | Phaser 3 integrato nell'app Ionic per le scene animate |
| Test | Vitest per motore, contenuti e simulatore |
| Validazione dati | Zod (schema dei JSON di contenuti e configurazione) |
| Salvataggi | Capacitor Preferences / Filesystem (JSON versionato) |
| Lint / formato | ESLint + Prettier |
| Simulatore | CLI Node.js che usa il motore |

---

## 4. Struttura del repository

```
/
├─ CLAUDE.md
├─ CHANGELOG.md
├─ ASSETS.md                  # elenco di ogni asset esterno con licenza
├─ .claude/
│  ├─ settings.json           # impostazioni condivise (attribuzione disattivata)
│  └─ memory/                 # memoria del progetto, VERSIONATA
├─ docs/
│  ├─ design/                 # decisioni di game design (sintesi del documento)
│  ├─ design-system.md        # stile grafico, colori, tipografia, componenti
│  ├─ content-style-guide.md  # come si scrivono gli eventi
│  └─ architecture.md
├─ packages/
│  ├─ engine/                 # motore di gioco (puro)
│  ├─ content/                # eventi, club, nomi, testi (JSON) + schema + validatore
│  ├─ config/                 # parametri di bilanciamento (JSON) + schema
│  ├─ simulator/              # CLI che gioca carriere automatiche
│  └─ app/                    # app Ionic/Angular (+ Phaser in fase 2)
└─ pnpm-workspace.yaml
```

Regole di dipendenza: `app` → `engine`, `content`, `config`. `simulator` → `engine`, `content`, `config`. `engine` **non importa mai** `app`, Angular, Ionic, Phaser, Capacitor o API del browser.

---

## 5. Principi di architettura del motore

1. **Stato immutabile, funzioni pure.** Ogni azione è `(stato, comando) => { stato, report }`. Nessun effetto collaterale.
2. **Determinismo.** Vietato `Math.random()` e `Date.now()` nel motore. Usa la classe `Rng` con seme (es. mulberry32 o xoshiro); lo stato del generatore è salvato in `GameState`. Stesso seme + stesse scelte = stessa carriera (serve per test, bug e simulatore).
3. **Nessun numero magico.** Ogni costante di gioco (probabilità, crescita, soglie, effetti) sta in `packages/config/*.json`, validata con Zod.
4. **Contenuti come dati.** Eventi, club, nomi e testi stanno in `packages/content/`. Aggiungere un evento non richiede codice.
5. **Salvataggi versionati.** `GameState.saveVersion` + funzioni di migrazione per ogni cambio di formato.
6. **API del motore piccola e stabile** (`packages/engine/src/index.ts`):
   - `newCareer(options, seed): GameState`
   - `getWeekOptions(state): WeekOption[]`
   - `planWeek(state, choices): { state, report }`
   - `resolveEvent(state, eventId, choiceIndex): { state, report }`
   - `playMatch(state, decide: KeyMomentDecider): { state, matchReport }` (in UI il decisore è il giocatore; nel simulatore è una strategia)
   - `endSeason(state): { state, seasonReport }`
   - `serialize(state) / deserialize(json)`

---

## 6. Modello dati (punto di partenza)

```ts
type Role = 'GK' | 'DEF' | 'MID' | 'ATT';
type Skill = 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'vision' | 'goalkeeping';

interface Player {
  id: string;
  firstName: string; lastName: string;
  birthWeek: number;              // settimana assoluta di nascita
  hometown: string;               // città italiana reale
  role: Role;
  skills: Record<Skill, number>;  // 0-100
  potential: number;              // 60-95, NASCOSTO al giocatore
  condition: { form: number; energy: number; morale: number; injuryRisk: number };
  persona: { discipline: number; temperament: number; happiness: number };
  image: { popularity: number; reputation: number; followers: number };
  money: { cash: number; salaryWeekly: number; assets: number };
  traits: string[];               // id da content/traits.json
  injury?: { type: string; weeksLeft: number };
  contract?: Contract;
  clubId?: string;
  relationships: Record<string, number>; // npcId -> -100..100
  flags: Record<string, number | boolean | string>;
  history: SeasonRecord[];
}

interface GameState {
  saveVersion: number;
  seed: number; rngState: number[];
  week: number; season: number;   // settimana assoluta e stagione corrente
  player: Player;
  world: { clubs: Club[]; leagues: League[]; competitions: Competition[]; npcs: Npc[] };
  calendar: Fixture[];
  eventLog: { eventId: string; week: number; choice: number }[];
  cooldowns: Record<string, number>;   // eventId -> settimana di riattivazione
  scheduled: { eventId: string; atWeek: number }[]; // catene di eventi
}
```

L'OVR si calcola dalle abilità pesate per ruolo (pesi in `config/ratings.json`).

---

## 7. Sistema eventi

Ogni evento è un file JSON (o un elemento di un array) in `packages/content/events/<categoria>/`.

```json
{
  "id": "mercato_offerta_estero_01",
  "category": "transfer",
  "conditions": {
    "age": { "min": 22 },
    "stats": [{ "path": "image.popularity", "gte": 60 }],
    "window": "summer",
    "flagsNot": ["trasferito_estero"]
  },
  "weight": 3,
  "cooldownWeeks": 52,
  "textKey": "events.mercato_offerta_estero_01.text",
  "choices": [
    {
      "textKey": "events.mercato_offerta_estero_01.c1",
      "effects": [
        { "type": "stat", "path": "money.cash", "delta": 40000 },
        { "type": "stat", "path": "persona.happiness", "delta": -10 },
        { "type": "startTransfer", "to": "random_foreign_top" }
      ]
    },
    {
      "textKey": "events.mercato_offerta_estero_01.c2",
      "effects": [
        { "type": "stat", "path": "image.reputation", "delta": 8 },
        { "type": "schedule", "eventId": "tifosi_striscione_01", "inWeeks": 2 }
      ]
    }
  ]
}
```

- Tipi di effetto iniziali: `stat`, `flag`, `relationship`, `schedule` (catene), `startTransfer`, `injury`, `money`, `trait`. Nuovi tipi solo con schema + test.
- Testi con segnaposto: `{firstName}`, `{club}`, `{agent}`, `{coach}`, `{city}`. Ogni evento frequente ha 2–3 varianti di testo.
- Selezione: filtra per condizioni e cooldown, poi estrazione pesata con `Rng`. Massimo 0–2 eventi a settimana (in config).
- **Validatore** (`pnpm content:check`): schema Zod, chiavi di testo esistenti, eventi richiamati da `schedule` esistenti, nessun id duplicato, percorsi `path` validi. Deve girare nei test.
- Guida di stile in `docs/content-style-guide.md`: tono realistico e ironico, mai volgare; frasi brevi; lessico calcistico italiano; nessuna scelta sempre giusta.

---

## 8. Partita e momenti chiave

1. Convocazione: titolare / panchina / fuori in base a OVR, forma, fiducia dell'allenatore, concorrenza nel ruolo.
2. Simulazione a 6 blocchi da 15 minuti; la forza delle squadre viene dal rating dei club.
3. Momenti chiave: 3–6 per partita in base a ruolo e minuti giocati. Tipi per ruolo (es. ATT: occasione in area, contropiede, rigore; DEF: uno contro uno, anticipo; GK: tiro ravvicinato, uscita).
4. Ogni momento offre 2–4 opzioni; ogni opzione ha pesi sulle abilità e una difficoltà. Probabilità di successo = funzione logistica di (abilità pesata − difficoltà) + modificatori (forma, morale, tratti), limitata tra 5% e 95%. Tutti i parametri in `config/match.json`.
5. Esito: risultato, tabellino, **voto in pagella** 4–10 (passi di 0,5), una riga di commento. Voto base 6, modificato da contributi e risultato.

---

## 9. Bilanciamento e simulatore

- `pnpm sim --careers 5000 --strategy cautious|aggressive|random --seed 42` gioca carriere complete senza UI e scrive un riepilogo (JSON + tabella in console).
- Metriche da riportare: età media di esordio in massima serie, % di carriere che arrivano in massima serie, gol e presenze medie, trofei, età di ritiro, % carriere "leggenda".
- Obiettivi iniziali (da tarare con l'utente): massima serie raggiungibile dalla maggior parte delle carriere giocate con attenzione, "leggenda" rara (pochi casi su 100), carriera completa 2–4 ore di gioco.
- Ogni modifica a `config/` deve essere accompagnata da un'esecuzione del simulatore e dal confronto dei numeri.

---

## 10. Grafica e interfaccia

L'utente non ha esperienza di grafica per giochi: la qualità visiva è responsabilità tua. Obiettivo: un gioco che sembri curato e coerente, non un'app gestionale.

### Uso delle skill
- Per **ogni schermata o componente di interfaccia** usa la skill **`frontend-design`** prima di scrivere il codice.
- Mantieni `docs/design-system.md` come unica fonte di verità per stile, colori, tipografia, spaziature e componenti. Ogni nuova schermata deve usare quei token.

### Direzione visiva (fase 1)
- Ispirazione: **giornale sportivo italiano incontra app moderna**. Pagelle come badge numerici grandi, titoli in stile prima pagina, messaggi del procuratore come chat, eventi come "notizie".
- Modalità scura predefinita (tonalità verde campo profondo), modalità chiara disponibile.
- Tipografia: un font condensato per titoli e numeri (es. Barlow Condensed o Oswald) e un sans-serif leggibile per i testi (es. Inter). Solo font con licenza libera (OFL), inclusi nell'app, non da CDN.
- Colori come variabili CSS / token Ionic in un unico file di tema.
- Icone: Ionicons (già in Ionic). Animazioni brevi e leggere (150–300 ms), niente effetti pesanti.
- Mobile first: target 360–430 px di larghezza, pulsanti grandi, una mano.

### Grafica generata dal codice (niente illustratore in fase 1)
- **Stemmi dei club** in SVG generati proceduralmente da: forma (scudo, cerchio, ovale), 2 colori, simbolo semplice, iniziali. Deterministici dal seme del club.
- **Maglie** in SVG da colori e motivo (tinta unita, strisce verticali, orizzontali, banda).
- **Avatar del giocatore** stilizzato in SVG componibile (volto, capelli, carnagione, maglia), semplice ma gradevole.
- Ogni asset esterno (font, suoni, immagini) va registrato in `ASSETS.md` con fonte e licenza; preferire CC0 o OFL. Mai asset senza licenza chiara.

### Schermate fase 1
Creazione giocatore · Home settimana (stato, azioni, prossima partita) · Evento (testo + scelte) · Partita (cronaca + momenti chiave + pagella) · Profilo (statistiche, tratti, grafici di crescita) · Carriera (storico stagioni, trofei) · Mercato/contratti · Finanze e vita · Fine carriera (punteggio) · Impostazioni.

### Fase 2 (2D)
- Phaser 3 dentro l'app Ionic, una scena per tipo di momento chiave; il motore decide sempre l'esito, Phaser lo mostra.
- Stile flat vettoriale visto dall'alto: campo disegnato dal codice, giocatori come figure semplici con i colori delle maglie procedurali.
- Prima di partire: prototipo di un momento chiave da far approvare all'utente.

---

## 11. Milestone (in ordine)

Ogni milestone è finita quando: build ok, lint ok, test verdi, `CHANGELOG.md` aggiornato, memoria aggiornata.

- **M0 – Setup:** monorepo pnpm, TypeScript strict, ESLint/Prettier, Vitest, `.gitignore` (senza escludere `.claude/memory/`), `.claude/settings.json`, cartelle docs, script `test`, `lint`, `content:check`, `sim`.
- **M1 – Nucleo motore:** tipi, `Rng` con seme, `GameState`, serializzazione con `saveVersion`, test di determinismo.
- **M2 – Mondo:** generazione piramide italiana fittizia (2 livelli dilettanti, Serie D, 3ª, 2ª, massima), club con città reali e nomi inventati, rose generate, stemmi e maglie (dati per l'SVG).
- **M3 – Calendario e stagione:** calendario andata/ritorno, classifiche, promozioni/retrocessioni, finestre di mercato, `endSeason`.
- **M4 – Partita:** convocazione, simulazione a blocchi, momenti chiave, pagella, statistiche.
- **M5 – Eventi:** schema, validatore, selezione pesata, catene, 20 eventi di esempio scritti con la guida di stile.
- **M6 – Progressione:** allenamento, crescita per età e potenziale, forma/energia/morale, infortuni, declino.
- **M7 – Economia e mercato:** contratti, procuratore, offerte, trattative, prestiti, sponsor, spese.
- **M7b – Coppe:** coppa nazionale a eliminazione diretta (tutti i livelli professionistici più le migliori dilettanti) e le due coppe europee per le prime classificate della massima serie, inserite nel calendario nelle settimane infrasettimanali; trofei nello storico.
- **M8 – Simulatore:** CLI con strategie, report delle metriche (sezione 9).
- **M9 – App (UI):** design system + tutte le schermate della sezione 10, usando `frontend-design`.
- **M10 – Salvataggi:** salvataggio automatico ogni settimana, più slot, migrazioni.
- **M11 – Servizi:** interfacce per analytics, pubblicità a premio e acquisti in-app, con implementazioni finte per lo sviluppo; integrazione reale solo su richiesta.
- **M11b – Editor:** schermata per rinominare club, giocatori e competizioni e cambiarne i colori; esportazione/importazione JSON con validazione; le modifiche si applicano sopra il mondo generato senza alterare i dati originali.
- **M13 – Basi:** difficoltà iniziale (facile/normale/difficile), tutorial facoltativo prima della prima carriera, impostazione della modalità di gioco (testuale; le partite animate 2D arriveranno con la fase 2).
- **M14 – Personaggio:** avatar più umano e dettagliato (corporatura, viso, accessori), tatuaggi anche durante la carriera.
- **M15 – Finanze:** conto deposito, investimenti inventati (borsa, cripto) con guadagni e perdite, mutui e prestiti, acquisto di case, ville, yacht, auto, attività del giocatore (ristorante, marchio di abbigliamento…), con vignette illustrate.
- **M16 – Vita privata:** incontri, relazioni, tradimenti, matrimonio, figli, feste e vita fuori dal campo, con vignette illustrate. Tono allusivo, obiettivo PEGI 12.
- **M17 – Media:** social del calciatore, interviste e conferenze stampa.
- Le vignette sono SVG piatti disegnati dal codice, nello stile di stemmi e avatar. M13–M17 vengono prima di M12.
- **M12 – Pubblicazione Android:** icona, splash, build firmata, checklist per Google Play; controllo che nessun nome storpiato coincida con un nome reale o un marchio registrato (registri pubblici e banche dati dei marchi), parere legale consigliato sui nomi storpiati e sulla proprietà intellettuale.
- **Contenuti (in parallelo da M5):** 100 eventi per la versione di prova, poi 300 per la completa.
- **Fase 2:** solo dopo approvazione esplicita dell'utente.

---

## 12. Comandi e impostazioni

```bash
pnpm install
pnpm test               # tutti i test
pnpm lint
pnpm content:check      # valida eventi e testi
pnpm sim --careers 1000 --strategy cautious --seed 42 [--difficulty easy|normal|hard]
pnpm --filter app start # app nel browser
pnpm --filter app build && npx cap sync android
```

File di impostazioni di Claude Code (forniti insieme a questo file):
- `.claude/settings.json` (versionato): attribuzione disattivata in commit e PR; permessi in autonomia (modifiche ai file e comandi da terminale senza conferma) con una lista di comandi distruttivi bloccati.
- `.claude/settings.local.json` (non versionato, specifico della macchina): `autoMemoryDirectory` con il **percorso assoluto** di `.claude/memory` di questo repository. I percorsi relativi vengono ignorati.

---

## 13. Cose da non fare
- Non usare nomi reali scritti esatti, stemmi, loghi, maglie o marchi reali, nemmeno come esempi nei test o nei file dell'editor. I nomi storpiati sono ammessi (sezione 2).
- Non usare `Math.random()`, `Date.now()` o API del browser nel motore.
- Non scrivere numeri di bilanciamento nel codice.
- Non chiedere il permesso per comandi da terminale già consentiti: procedi.
- Non usare force push, `git reset --hard` o `sudo`.
- Non inserire riferimenti a Claude o all'AI in commit, PR, codice o documentazione.
- Non mettere `.claude/memory/` in `.gitignore`.
- Non iniziare la fase 2D senza approvazione dell'utente.
