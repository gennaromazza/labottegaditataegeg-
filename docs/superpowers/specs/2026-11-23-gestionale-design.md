# Gestionale "La Bottega di Tata e Gegè" – Design

Data: 2026-11-23 · Stato: da approvare

## Intento
Due o tre artigiani (candele, segnaposti, lettere e nomi personalizzati, decorazioni) ricevono ordini da TikTok, WhatsApp e social. Oggi le informazioni si sparpagliano. Serve un gestionale web semplice, usabile soprattutto da telefono mentre chattano col cliente, che tenga ordini, clienti, pagamenti (anche più acconti) e un riepilogo degli incassi.

## Obiettivi
- Creare un ordine in meno di un minuto da smartphone.
- Elenco ordini con stato e residuo da incassare sempre visibili.
- Inviare la copia dell'ordine al cliente: messaggio WhatsApp precompilato (`wa.me`) e PDF con logo.
- Riepilogo incassi per periodo, canale e metodo.
- App installabile sul telefono (PWA), in italiano, stile caldo (legno/arancio del logo).
- Tutto su Firebase, configurato da terminale (Firebase CLI), piano gratuito (Spark).

## Non obiettivi
- Magazzino, fatturazione elettronica, e-commerce pubblico, email automatiche, pagamenti online.
- Registrazione pubblica o gestione utenti dentro l'app.

## Anti-obiettivi (sarebbe un fallimento)
- Dati leggibili da chi non è autorizzato.
- Troppi passaggi per inserire un ordine.
- Incassi calcolati in modo diverso tra schermate.

## Vincoli
- Nessun backend a pagamento: niente Cloud Functions, quindi niente piano Blaze.
- Il PDF è generato nel browser (jsPDF o simile).
- Accesso solo per account creati da noi; il login è obbligatorio per ogni schermata.

## Approcci considerati
1. HTML/JS semplice: veloce ma non mantenibile con questa mole.
2. **React + Vite + TypeScript + Firebase (Hosting, Firestore, Auth) – scelto dall'utente.** PWA, PDF client-side, tutto nel piano gratuito.
3. Next.js + Cloud Functions: richiede Blaze, eccessivo.

## Modello dati (Firestore)
- `clienti/{id}`: nome, telefono (formato internazionale per wa.me), note, creatoIl, **spedizione** (facoltativa: destinatario se diverso, indirizzo, CAP, città, provincia).
- `ordini/{id}`: numero progressivo, clienteId + nome/telefono copiati, canale (TikTok | WhatsApp | Instagram | Facebook | Altro), righe[{descrizione, testoPersonalizzato, quantita, prezzoUnitario}], totale, stato (da fare | in lavorazione | pronto | consegnato | annullato), dataConsegna, note, creatoIl, pagamenti[{importo, data, metodo?}].
- `listino/{id}` (facoltativo): nome, prezzo, attivo.
- Residuo = totale − somma pagamenti; stato pagamento derivato: non pagato / acconto / saldato. Non si salva, si calcola.
- Incassi = pagamenti raggruppati per **data del pagamento** (non dell'ordine). Ordini annullati: i pagamenti restano visibili e si segnalano come da rimborsare.

## Schermate
1. Login (email e password).
2. Ordini: lista a schede su telefono, tabella su PC; filtri per stato e canale; pulsante grande "Nuovo ordine".
3. Nuovo/Modifica ordine: cliente (cerca o crea al volo), righe, acconto iniziale, consegna.
4. Dettaglio ordine: pagamenti (aggiungi), cambia stato, "Invia su WhatsApp", "Scarica PDF".
5. Clienti: elenco, scheda con storico ordini e totale speso e un riquadro "Dati di spedizione" modificabile.
6. Incassi: totale per mese/periodo, per canale e per metodo, residuo complessivo da incassare, grafico semplice.
7. Listino (secondaria).

## Sicurezza
- Firebase Auth email/password, nessuna registrazione dall'app.
- Regole Firestore: lettura/scrittura solo se `request.auth != null` e l'email è nella lista degli autorizzati scritta nelle regole. Pubblicate con `firebase deploy --only firestore:rules`.
- Gli account si creano dalla console/terminale, non dall'app (creare utenti dall'app richiederebbe Cloud Functions).
- "Admin": tutti gli utenti autorizzati hanno gli stessi permessi. Un ruolo separato è fuori ambito.

## Decisioni mie (da controllare)
- Listino facoltativo; le righe si possono scrivere a mano.
- Metodo di pagamento facoltativo.
- Numerazione ordini progressiva tramite transazione Firestore.
- PDF e messaggio WhatsApp: logo, numero ordine, righe, totale, versato, residuo, data consegna.
- Test: logica di calcolo (residuo, stato pagamento, incassi per periodo, messaggio WhatsApp) con test automatici; verifica a mano nel browser su larghezza telefono e PC.

## Da definire con l'utente prima del piano
- Quante persone usano l'app e le loro email (per account e regole).
- Il progetto Firebase: esiste già o lo creiamo da CLI? (serve `firebase login` fatto da te).

## Lasciato al costruttore
Struttura delle cartelle, libreria dei grafici, dettagli grafici, nome del progetto Firebase.
