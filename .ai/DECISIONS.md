# Decisioni tecniche

<!-- Solo in coda. Formato:
## YYYY-MM-DD — titolo
- Decisione:
- Perché:
- Alternative scartate:
Decisioni con il cliente o commerciali: proporle per il registro di base-aziendale. -->

## 2026-11-17 — Tempo reale come dato dei comandi
- Decisione: tutto ciò che viene dal mondo reale (qualità del minigioco, ore di assenza, video visto) entra nel motore come dato dei comandi (`decide` → `{ optionIndex, quality }`, `collectIdle(hours)`, `grantReward(kind)`).
- Perché: il motore resta puro e deterministico (CLAUDE.md §5).
- Alternative scartate: leggere l'orologio o lo stato pubblicitario dentro il motore.

## 2026-11-17 — Phaser 4 come renderer mobile
- Decisione: Phaser 4.2.1 differito in Angular/Capacitor; il motore TypeScript resta autorevole.
- Perché: scene e input sul dispositivo senza duplicare carriera o salvataggi. Prove in `reports/prove-motore-mobile/README.md`.
- Alternative scartate: migrazione Godot/Unity e renderer manuale, per costo di riscrittura e manutenzione.

## 2026-11-17 — Interfaccia ibrida giornale + pixel
- Decisione: carta e titoli da giornale per notizie e pagelle, strato pixel (Jersey 15 da 20 px in su, cornici box-shadow) per numeri, icone e stemmi. Modalità partita predefinita salvata in Preferences; la simulazione automatica parte solo nel passo partita.
- Perché: scelta dell'utente ("ibrido spinto, mantieni lo stile di giornale"); dettagli in `docs/design-system.md` e `.claude/memory/ui-ibrido.md`.
- Alternative scartate: pixel su tutta l'interfaccia (testi lunghi illeggibili), solo giornale (poco carattere da gioco).

## 2026-11-18 — Nucleo prima delle meccaniche nuove (approccio B)
- Decisione: prima si rifanno partita (regista di tensione, cronaca con pressione, catene, gesti al posto della barra) e stagione (capitoli, 2–3 partite giocate a capitolo, resto in riepilogo); poi settimana, collegamenti fra sistemi e solo dopo M19–M23.
- Perché: l'utente trova il gioco piatto e poco chiaro; aggiungere sistemi sopra un nucleo opaco peggiora. Dettagli in `docs/superpowers/specs/2026-11-18-regista-partita-stagione-design.md`.
- Alternative scartate: seguire M18–M23 così com'è; un unico ridisegno totale del motore.

## 2026-11-18 — Regista: meccaniche aggiunte e formato dei salvataggi
- Decisione: preavviso solo sulle radici, respiro dopo gol e catene, "chiudi" sicuro nelle catene, momenti per funzione (mai lo stesso tipo due volte di fila), passo decisivo in pagella, momenti da leggenda solo come archetipi, prima pagina e obiettivo di capitolo. Gesto ±0,10 con tetto 0,15. Nessun aggiustamento nascosto degli esiti. Un formato di salvataggio per parte: v2 Parte A, v3 Parte B. `rival` riservato al rivale di carriera, in partita `keyOpponent`.
- Perché: ricerca in `reports/Meccaniche regista partita e stagione.md` e scelte dell'utente; review Codex sul piano.
- Alternative scartate: richiami in cronaca (P6), gesto a ±15, leggende con riferimenti reali, una versione di salvataggio per task.

## 2026-11-19 — Partita rapida e ciclo a capitoli
- Decisione: la rapida ha lo stesso budget del regista di full e sim (5–7 momenti), ne mostra 1–2 e risolve gli altri col decisore automatico; leggende solo sui passi visibili; almeno un passo visibile garantito. 4 partite scelte per capitolo (`chapterMatches.max`). `fastForward` resta un ciclo suo ma gestisce i confini di capitolo con gli stessi helper di `advanceToStop`.
- Perché: con budget 1–2 giocare una partita rendeva meno che simularla (41,5 gol contro 58,9); pareri concordi di architetto e Codex forte. Durata nel bersaglio senza toccare `secondsPer`.
- Alternative scartate: più xG in config (gonfia la squadra, non il giocatore); nuova baseline accettando il calo; `fastForward` come wrapper (sposterebbe criterio e baseline).

## 2026-11-20 — Skill di sviluppo giochi e suoni
- Decisione: 10 skill esterne in `.claude/skills/` (Game Studio: phaser-2d-game, game-ui-frontend, game-playtest; awesome-gamedev: phaser-core, game-feel, rpg, roguelike, game-ui-ux, audio-design, game-docs), testo originale invariato più una sezione di progetto che prevale; versionate con LICENSE e NOTICE. Suoni con `zzfx` generati dal codice; audio di Phaser spento.
- Perché: coprono scene, UI, QA e bilanciamento senza cambiare stack; zzfx mantiene "nessun asset esterno". Screening e review con Codex.
- Alternative scartate: `phaser.io/llms.txt` (indice commerciale di Phaser AE; fanno fede i tipi locali), `web-game-foundations`, save-systems, dialogue-systems, visual-novel (esempi Godot/Unity su sistemi già presenti), file audio esterni.

## 2026-11-20 — Home in tre strati e Bacheca
- Decisione: home con stato e avvisi compatti, prossima partita, scheda capitolo e una sola CTA fissa; prima pagina come foglio chiuso con `frontSeen` (solo in memoria); premi degli obiettivi automatici e visibili prima; storico in `GameState.goalRecords` facoltativo, senza cambiare `saveVersion`; Carriera rinominata Bacheca.
- Perché: l'utente trovava la home confusionaria e voleva una sezione premi; opzione A scelta dall'utente. Campo facoltativo come i precedenti `finance?` ed `edits?`.
- Alternative scartate: pulsante "ritira" per i premi; schermata premi separata; prima pagina sempre in cima alla home.

## 2026-11-20 — Settimana a due binari
- Decisione: il piano del capitolo diventa `{ load, focus?, life? }`: carico Scarico/Equilibrio/Spinta con tetto di freschezza 100/90/70 e una sola azione fuori dal campo come modificatore dichiarato (Famiglia protegge il morale e l'affinità, Svago accelera la risalita del morale, Sponsor soldi, Serata popolarità con costi scritti). Freschezza unica (campo `energy`) al posto di energia e `injuryRisk`, lineare, anche nella convocazione. Crescita senza arrotondamenti, focus a punti invariati, declino pesato sulle settimane di carico, disciplina che torna alla base. Anteprima dal motore con le stesse funzioni dell'esito. Salvataggi v4.
- Perché: sonda e audit hanno mostrato una scelta dominante (intenso + riposo, 9% leggende), riposo come tassa, svago e sponsor trappola sulla disciplina, crescita persa per arrotondamento, felicità senza effetti, serate filtrate. Scelta dell'utente (approccio B); tetto e convocazione decisi dall'utente dopo i pareri di architetto e Codex forte.
- Alternative scartate: ritocco delle 9 azioni (resta una tabella di decimali); calendario a gettoni settimanale (sfora 20–30 minuti a stagione); Spinta senza tetto da tarare solo col simulatore.
