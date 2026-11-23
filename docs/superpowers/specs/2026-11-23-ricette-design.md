# Ricette e scarico automatico del magazzino – Design

Data: 2026-11-23 · Stato: **implementato e verificato** (approvato dall'utente)

## Intento
Ogni **Prodotto** ha una **ricetta**: i **Materiali** del magazzino che servono per farne un pezzo, con le quantità (es. segnaposto 3D: 18 g di filamento + 1 pezzo di anello; candela: 200 g di cera + 3 pezzi di stoppino). Quando un ordine inizia a essere lavorato, i materiali si scalano da soli dal magazzino, così si sa sempre quanto resta e se ne basta per i prossimi ordini.

## Scelte dell'utente
- **Quando si scala:** quando l'ordine passa a *In preparazione*.
- **Se i materiali non bastano:** si avvisa e decide l'utente (procedere o fermarsi a riordinare).
- **Quantità:** fissa per pezzo (niente "per lettera" per ora).
- **Dove:** la ricetta sta dentro la scheda del Prodotto nel Magazzino (nessuna pagina nuova).

## Obiettivi
- Scrivere la ricetta di un Prodotto: elenco di Materiali con quantità nell'unità che si preferisce (g su una scorta in kg va bene).
- Avviso chiaro prima di iniziare la preparazione: "Filamento: servono 540 g, ne hai 300 g".
- Scarico automatico e **una sola volta** per ordine, visibile nello storico del magazzino ("Ordine n. 7").
- Se l'ordine viene annullato o torna indietro prima della spedizione, i materiali tornano in magazzino.
- Poter vedere nell'ordine cosa è stato scalato.

## Non obiettivi (per ora)
Costo e margine per ricetta, quantità per lettera, scarti di stampa (%), produzione in anticipo di prodotti finiti con la loro giacenza, scorta minima, riordino automatico.

## Le mie scelte (da controllare)
1. **Collegamento riga d'ordine ↔ prodotto.** Oggi le righe copiano nome e prezzo e non ricordano quale articolo le ha generate. Si aggiunge `articoloId` alle righe **scelte dalla lista prodotti**; le righe scritte a mano e gli ordini già esistenti **non scalano** nulla (nessuna ipotesi sul nome).
2. **Quantità dell'ordine:** si scala `quantità riga × quantità ricetta` per ogni materiale (3 segnaposto × 18 g = 54 g).
3. **Ricetta salvata in unità base** (come la giacenza): si inserisce in g/kg/ml/l/pezzi/cm/m, purché della stessa famiglia del materiale. Solo i *Materiali* possono essere ingredienti.
4. **Una volta sola:** l'ordine registra `scaricoMagazzino` (data e cosa è stato scalato). Passare di nuovo a *In preparazione* non scala di nuovo.
5. **Ripristino:** se l'ordine va ad *Annullato* o torna a *In attesa/Confermato* prima della spedizione, si fa un carico di ritorno per ogni materiale (nota "Ordine n. 7 annullato"). Se è già *Spedito/Consegnato* non si ripristina (la merce è partita). Eliminare un ordine non ancora spedito che aveva scalato ripristina allo stesso modo.
6. **Se non bastano:** l'avviso elenca i materiali mancanti. Con "Procedi comunque" si scala **quanto c'è** (la giacenza non va mai sotto zero) e il movimento riporta cosa mancava; lo storico lo rende visibile. Con "Ferma" l'ordine resta com'è.
7. **Prodotti senza ricetta** non scalano nulla e non danno avvisi. Se un ingrediente è stato disattivato, lo si segnala nell'avviso.
8. **Un'unica transazione Firestore** aggiorna l'ordine, le giacenze e i movimenti, quindi con due persone insieme i conti non si sporcano. Se l'ordine ha molti materiali diversi resta ben sotto i limiti di Firestore.

## Dati
- `listino` (articoli): nuovo campo opzionale `ricetta: [{ articoloId, quantita }]` (quantità in unità base) sui Prodotti. Nessuna migrazione: manca = senza ricetta.
- `ordini`: `righe[].articoloId?` e `scaricoMagazzino?: { data, voci: [{ articoloId, nome, quantita, mancante? }] }`.
- `movimenti`: si usa la collezione esistente con tipo `scarico` o `carico` e nota "Ordine n. X".
- Regole Firestore: nessuna modifica (stesse collezioni).

## Schermate
- **Scheda del Prodotto (Magazzino):** sezione *Ricetta* richiudibile: elenco ingredienti, aggiungi materiale (ricerca + quantità), togli, salva. Mostra "Con la giacenza attuale puoi fare N pezzi".
- **Dettaglio ordine e Spedizioni:** prima di "Inizia la preparazione" compare il controllo dei materiali (ok / mancano). Dopo lo scarico, nell'ordine c'è "Materiali scalati: …".

## Verifica
Test automatici su: fabbisogno di un ordine, disponibilità e mancanti, piano di scarico (anche parziale), ripristino, conversioni g↔kg, nessun doppio scarico, nessuna giacenza negativa, ordini senza ricetta o con righe manuali, interfaccia della ricetta e dell'avviso. La transazione Firestore non si può provare senza Java: la logica sta in funzioni pure testate.

## Rischi noti
- Chi inserisce le righe a mano non scala: va usata la lista prodotti (l'interfaccia lo ricorda).
- Prodotti con molti pezzi e ricette lunghe: i numeri restano interi in unità base, nessun arrotondamento.
