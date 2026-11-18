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
