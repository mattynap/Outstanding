# Handoff

## Stato
Sessione di design sul motore. L'utente trova il gioco piatto: partita monotona, scelte senza seguito,
momenti a caso, minigioco inutile, stagioni troppo lunghe.
Scelto l'approccio B: prima rifare il nucleo (partita, stagione, settimana, collegamenti fra sistemi),
poi M19–M23. Direzione approvata e scritta in
`docs/superpowers/specs/2026-11-18-regista-partita-stagione-design.md` (non ancora committato).
Nessuna modifica al codice.

## Prossimo passo
Obiettivo della prossima sessione: impostare il regista della partita e della stagione.
1. Committare lo spec (`docs: design regista partita e stagione`).
2. Builder check dello spec, poi chiudere con l'utente le domande aperte del §5 (stagione).
3. Piano con `writing-plans`: prima la partita (cronaca + pressione, tensione, catene, conseguenze,
   rischio contestuale, gesti), poi la stagione a capitoli.
4. Nel simulatore: strategia "contestuale" e misura del tempo di gioco (bersaglio 20–30 min a stagione, 6–8 ore a carriera).

## Blocchi e domande aperte
- Stagione a capitoli: la pianificazione settimanale diventa per capitolo? Il giocatore può chiedere di giocare una partita non scelta dal regista? Che ruolo restano ad avanti veloce e piano ricordato?
- Peso del gesto in partita: da tarare (oggi ±10 punti).
- Restano aperte dalle sessioni precedenti: decisioni dell'offerta (`founder/offer.md`), prova con i tester, feedback iPhone dell'interfaccia ibrida.

## File toccati
- `docs/superpowers/specs/2026-11-18-regista-partita-stagione-design.md` (nuovo)

## Skill consigliate
- brainstorming (per chiudere §5), writing-plans, test-driven-development, frontend-design per la schermata partita.

## Firma
Claude Code, Opus 5.5, 2026-11-18. Deleghe Codex oggi: 4 (leggero 3, standard 1); in questa sessione 0.
