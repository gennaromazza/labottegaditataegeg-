# Magazzino (evoluzione del Listino) – Design

Data: 2026-11-23 · Stato: approvato dall'utente (scelte: lista unica, storico movimenti)

## Intento
Il Listino diventa un **Magazzino**: ogni articolo ha un'unità di misura e una giacenza. In un secondo momento un modulo **Ricette** (es. una candela usa 20 g di cera e 3 pezzi di stoppino) scaricherà il magazzino, e si vedrà quanto ne resta.

## Obiettivi
- Un'unica lista di articoli con **tipo**: *Materiale* (si consuma nelle ricette) o *Prodotto* (si vende, ha un prezzo).
- **Unità di misura**: pezzi, grammi, chili, millilitri, litri, centimetri, metri.
- **Giacenza** sempre visibile; **carico**, **scarico** e **correzione** con nota; **storico** dei movimenti per articolo.
- Ricerca, filtri per tipo, comodo da telefono.
- Nessuna perdita dei dati del listino attuale; gli ordini già fatti non cambiano.

## Non obiettivi (per ora)
- Ricette e scarico automatico (modulo successivo), scorta minima, costo per unità, lotti/scadenze, scarico automatico alla vendita.

## Scelte di progetto
- **Giacenza in unità base intera** (g, ml, cm, pezzi): 1,25 kg si salva come 1250. Niente errori di virgola mobile; kg↔g e l↔ml sono solo una questione di visualizzazione. Le ricette potranno usare grammi su una scorta in chili.
- Unità offerte con decimali consentiti: pezzi 0, g 0, kg 3, ml 0, l 3, cm 0, m 2.
- Si può cambiare unità solo dentro la stessa famiglia (g↔kg, ml↔l, cm↔m); tra famiglie diverse solo se la giacenza è 0.
- Ogni cambio di giacenza passa da una **transazione Firestore** che aggiorna l'articolo e scrive il movimento insieme. Uno scarico oltre la giacenza è rifiutato con un messaggio chiaro ("ne restano X"); per sistemare un errore c'è "Imposta giacenza".
- Collezione `listino` mantenuta (nessuna migrazione): i campi nuovi hanno valori predefiniti in lettura (tipo Prodotto, unità pezzi, giacenza 0). Nuova collezione `movimenti`.
- Il nuovo ordine propone solo gli articoli di tipo Prodotto attivi.
- Nessuna eliminazione: gli articoli si **disattivano**, così lo storico resta leggibile.
- Rotta `/magazzino`; `/listino` rimanda lì.

## Approcci considerati
1. Due liste separate (listino + magazzino): più semplice da leggere, ma le ricette collegherebbero due elenchi. Scartata dall'utente.
2. **Lista unica con tipo** (scelta).
3. Solo giacenza senza movimenti: meno codice, ma nessuna traccia di dove va la merce. Scartata (l'utente vuole lo storico).

## Verifica
Test automatici su conversioni, parsing, regole di carico/scarico/correzione, pagina Magazzino, proposta dei soli Prodotti nel nuovo ordine, menu. La transazione Firestore non si può provare senza emulatore (serve Java): la logica sta in funzioni pure testate.
