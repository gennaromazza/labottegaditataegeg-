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

## Importi e date

Gli importi sono salvati in centesimi (interi). Le date sono stringhe `YYYY-MM-DD`.
Gli incassi sono contati per data del pagamento, non dell'ordine.
