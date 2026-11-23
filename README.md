# Gestionale La Bottega di Tata e Gegè

Web app (PWA) per ordini, clienti (con dati di spedizione), pagamenti/acconti e incassi.
React + Vite + TypeScript, Firebase (Hosting, Firestore, Authentication).

- Progetto Firebase: `labottega-tata-gege`
- Design: `docs/superpowers/specs/2026-11-23-gestionale-design.md`
- Piano: `docs/superpowers/plans/2026-11-23-gestionale-bottega.md`

## Comandi

```powershell
npm install
npm run dev          # sviluppo locale (serve .env.local con la config Firebase web)
npm test             # test dell'app
npm run build        # build in dist/
firebase deploy --only hosting     # pubblica l'app
firebase deploy --only firestore   # pubblica le regole del database
```

`.env.local` (non versionato) contiene le variabili `VITE_FIREBASE_*`; i valori si leggono con
`firebase apps:sdkconfig WEB <appId> --project labottega-tata-gege`.

## Chi può entrare

Solo gli account email/password creati da noi, e solo le email elencate in `firestore.rules`
(funzione `autorizzato()`). Per aggiungere una persona:

1. aggiungere la sua email alla lista in `firestore.rules` e pubblicare le regole;
2. creare l'account (console Firebase > Authentication > Utenti > Aggiungi utente);
3. farle impostare la password con l'email di reimpostazione (console Firebase > Authentication > menu dell'utente > Reimposta password).

## Test delle regole Firestore

`npm run test:rules` usa l'emulatore Firestore, che richiede **Java** installato.

## Stati degli ordini e Spedizioni

Flusso: **in attesa di acconto → confermato → in preparazione → pronto da spedire → spedito → consegnato** (oppure annullato).

- Senza almeno un pagamento registrato l'ordine non procede (regola in `src/lib/stati.ts`). Il primo acconto porta da solo l'ordine a "confermato"; togliendo l'unico acconto di un ordine solo confermato torna "in attesa".
- Gli ordini creati con i vecchi stati si leggono così: "da fare" diventa "in attesa di acconto" o "confermato" in base ai pagamenti, "in lavorazione" diventa "in preparazione" (nessuna migrazione dei dati).
- Pagina **Spedizioni** (`/spedizioni`): Da lavorare, Spediti, In attesa di acconto, Consegnati. Note di preparazione, corriere e tracking si inseriscono lì o nel dettaglio ordine.
- Quando segni "spedito" compare **Avvisa la spedizione su WhatsApp**: apre WhatsApp con il messaggio già scritto (`messaggioSpedizione` in `src/lib/whatsapp.ts`).
- Collegamenti: `/ordini?stato=…&canale=…&pagamento=da-incassare|saldati`, `/spedizioni?vista=spediti|attesa|consegnati`, `/spese?categoria=Spedizioni&descrizione=…`.
- Menu su telefono: Ordini, Spedizioni, Clienti, Incassi, Altro (Spese, Listino, Account, Esci). Su PC la barra laterale mostra tutto.

## Spese, utile, stampa, link

- **Spese**: pagina `/spese` con categorie (tra cui Spedizioni e Rimborsi), filtro per periodo e categoria e il totale delle spedizioni.
  La pagina Incassi mostra anche spese e utile del periodo (incassi meno spese). Un rimborso a un cliente si registra come spesa di categoria "Rimborsi".
- **Stampa**: pulsante "Stampa" nel dettaglio ordine e "Stampa elenco" nella lista (layout di stampa in `src/styles/stampa.css`).
- **Link ordine**: `https://<sito>/ordini/<id>`, si apre solo dopo il login (pensato per un futuro QR sul pacco).
  Un link pubblico per i clienti richiederebbe un'altra impostazione (token non indovinabile e regole dedicate).

## CAP, città e province

I suggerimenti usano `src/data/comuni.json`, generato con `node scripts/genera-comuni.cjs <comuni.json>` dal database non ufficiale
https://github.com/matteocontrini/comuni-json (dati ISTAT e CAP: la completezza dei CAP **non è garantita** dall'autore, serve come aiuto di compilazione).

## Importi e date

Gli importi sono salvati in centesimi (interi). Le date sono stringhe `YYYY-MM-DD`.
Gli incassi sono contati per data del pagamento, non dell'ordine.
