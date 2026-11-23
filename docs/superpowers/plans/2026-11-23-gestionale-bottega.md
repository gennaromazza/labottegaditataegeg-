# Gestionale La Bottega – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app (PWA) per ordini, clienti, pagamenti/acconti e riepilogo incassi, su Firebase Hosting + Firestore + Auth.

**Architecture:** React + Vite + TypeScript, una sola app client. La logica di calcolo (importi, stato pagamento, incassi, messaggio WhatsApp) sta in funzioni pure testate; le schermate le usano. Firestore tiene i dati, le regole limitano l'accesso a una lista di email autorizzate. PDF generato nel browser.

**Tech Stack:** React 18, Vite, TypeScript, React Router, Firebase JS SDK v10 (modulare), Vitest + Testing Library, `@firebase/rules-unit-testing` + emulatore Firestore, jsPDF, vite-plugin-pwa, Firebase CLI.

**Spec:** `docs/superpowers/specs/2026-11-23-gestionale-design.md`

## Global Constraints

- Piano Firebase Spark: niente Cloud Functions, niente Blaze.
- Interfaccia in italiano; palette calda ispirata al logo (legno/arancio); mobile first, tabella su PC.
- Nessuna registrazione pubblica; ogni schermata richiede login.
- Importi salvati come **interi in centesimi** (mia scelta, evita errori di virgola mobile); mostrati in euro con formato `it-IT`.
- Date salvate come stringa ISO `YYYY-MM-DD`.
- Incassi contati per **data del pagamento**.
- Canali: `TikTok | WhatsApp | Instagram | Facebook | Altro`. Stati: `da fare | in lavorazione | pronto | consegnato | annullato`.
- Tutta la configurazione Firebase da terminale con la CLI.

## Review Focus

- Telefono scritto in modi diversi (`333 1234567`, `+39 333…`, `0039…`, con trattini) → link WhatsApp corretto; telefono mancante → pulsante disabilitato, niente link rotto.
- Pagamenti oltre il totale o ordine con totale 0 → stato `eccedente`, residuo negativo mostrato, nessun crash.
- Ordine annullato con pagamenti già versati → resta negli incassi, segnalato "da rimborsare".
- Testo personalizzato con caratteri speciali (`&`, `#`, emoji, a capo) → messaggio WhatsApp con URL encoding corretto e PDF che non perde i caratteri.
- Due utenti creano un ordine nello stesso momento → numeri ordine mai duplicati.

---

### Task 1: Scaffold, tema e routing

**Files:**
- Create: progetto Vite in `D:\LABOTTEGA` (`package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/tema.css`), `.gitignore`, `public/logo.png` (copia del logo fornito dall'utente)
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `App` con rotte `/login`, `/ordini`, `/ordini/nuovo`, `/ordini/:id`, `/clienti`, `/clienti/:id`, `/incassi`, `/listino`; script `npm test` (vitest run), `npm run build`.

- [ ] **Step 1:** Scaffold con `npm create vite@latest . -- --template react-ts`, installare dipendenze della stack, configurare Vitest (jsdom) e `vite-plugin-pwa` (nome "La Bottega di Tata e Gegè", icone dal logo, `display: standalone`).
- [ ] **Step 2: Test che fallisce** `App.test.tsx::mostra_il_titolo_della_bottega`: render di `App` su `/login` contiene il testo `La Bottega`.
- [ ] **Step 3:** Run `npm test` → FAIL.
- [ ] **Step 4:** Implementare `App` con `BrowserRouter` e pagine segnaposto; tema in `tema.css` con variabili CSS (colori legno/arancio, font leggibile, bottoni grandi min 44px).
- [ ] **Step 5:** Run `npm test` e `npm run build` → PASS.
- [ ] **Step 6:** Commit `feat: scaffold app con tema e rotte`.

### Task 2: Logica di calcolo (pura, TDD)

**Files:**
- Create: `src/lib/tipi.ts`, `src/lib/calcoli.ts`, `src/lib/whatsapp.ts`
- Test: `src/lib/calcoli.test.ts`, `src/lib/whatsapp.test.ts`

**Interfaces:**
- Produces in `tipi.ts`: `Riga {descrizione: string; testoPersonalizzato?: string; quantita: number; prezzoUnitarioCent: number}`, `Pagamento {importoCent: number; data: string; metodo?: 'contanti'|'bonifico'|'paypal'|'altro'}`, `Ordine {id: string; numero: number; clienteId: string; clienteNome: string; clienteTelefono?: string; canale: Canale; righe: Riga[]; stato: StatoOrdine; dataConsegna?: string; note?: string; creatoIl: string; pagamenti: Pagamento[]}`, `Cliente {id: string; nome: string; telefono?: string; note?: string}`, `Canale`, `StatoOrdine`.
- Produces in `calcoli.ts`: `totaleCent(righe: Riga[]): number`, `versatoCent(o: Ordine): number`, `residuoCent(o: Ordine): number`, `statoPagamento(o: Ordine): 'non_pagato'|'acconto'|'saldato'|'eccedente'`, `incassiPerMese(ordini: Ordine[]): {mese: string; totaleCent: number}[]` (mese `YYYY-MM`, ordinato), `incassiPer(ordini: Ordine[], chiave: 'canale'|'metodo', da: string, a: string): {chiave: string; totaleCent: number}[]`, `daRimborsare(o: Ordine): boolean` (annullato con versato > 0), `formatEuro(cent: number): string`.
- Produces in `whatsapp.ts`: `normalizzaTelefono(raw: string, prefisso = '39'): string | null`, `messaggioOrdine(o: Ordine): string`, `linkWhatsApp(o: Ordine): string | null` (`https://wa.me/<numero>?text=<encodeURIComponent(messaggio)>`).

- [ ] **Step 1: Test che falliscono**, con questi valori:
  - `totaleCent`: 3 × 250 + 1 × 1000 = 1750; lista vuota = 0.
  - `statoPagamento`: nessun pagamento → `non_pagato`; 500 su 1750 → `acconto`; 500+1250 → `saldato`; 2000 su 1750 → `eccedente`; totale 0 senza pagamenti → `saldato`.
  - `incassiPerMese`: pagamenti 2026-11-05 (500) e 2026-11-20 (300) e 2026-12-01 (100) → `[{2026-11, 800}, {2026-12, 100}]`.
  - `incassiPer(... 'metodo' ...)`: pagamento senza metodo conta come `non indicato`; filtra su `da`/`a` inclusivi.
  - `daRimborsare`: annullato con 500 versati → true; annullato a 0 → false.
  - `normalizzaTelefono`: `'333 123-4567'`→`'393331234567'`, `'+39 333 1234567'`→`'393331234567'`, `'0039 333 1234567'`→`'393331234567'`, `''`→`null`, `'abc'`→`null`.
  - `linkWhatsApp`: ordine con testo `Mario & Lu #1 😀\nok` → URL contiene `%26`, `%23`, `%0A` e non contiene `&` non codificati nel testo; senza telefono → `null`.
  - `messaggioOrdine` contiene numero ordine, ogni riga, totale, versato, residuo, data consegna se presente.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementare le funzioni (aritmetica intera; `formatEuro` con `Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'})`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: logica di calcolo ordini, incassi e whatsapp`.

### Task 3: Firebase (progetto, regole, accesso ai dati)

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `src/firebase.ts`, `src/data/clienti.ts`, `src/data/ordini.ts`, `src/data/listino.ts`, `.env.local` (non versionato)
- Test: `firestore.rules.test.ts`, `src/data/ordini.test.ts` (contro emulatore)

**Interfaces:**
- Consumes: tipi del Task 2.
- Produces: `auth`, `db` da `firebase.ts`; `creaOrdine(dati: Omit<Ordine,'id'|'numero'|'creatoIl'>): Promise<Ordine>` (numero da transazione sul documento `meta/contatori`), `aggiornaOrdine(id, patch)`, `aggiungiPagamento(id, p: Pagamento)`, `ascoltaOrdini(cb)`, `ascoltaOrdine(id, cb)`; analoghi `creaCliente`, `ascoltaClienti`, `ascoltaCliente`, e `ascoltaListino`, `salvaVoceListino`.

- [ ] **Step 1 (azione dell'utente):** l'utente esegue `firebase login`; si ottengono le **email autorizzate** (da chiedere prima di questo passo se non ancora date).
- [ ] **Step 2:** Da terminale: `firebase projects:create` (o uso del progetto esistente), `firebase apps:create web`, `firebase init hosting firestore` (public = `dist`, SPA rewrite su `index.html`), abilitare Auth email/password, salvare la config in `.env.local`.
- [ ] **Step 3: Test regole che falliscono** con `@firebase/rules-unit-testing`: utente non loggato → nega lettura e scrittura; loggato con email non in lista → nega; email in lista → consente su `clienti`, `ordini`, `listino`, `meta`; nega qualunque altra collezione.
- [ ] **Step 4:** Scrivere `firestore.rules` con funzione `autorizzato()` = `request.auth != null && request.auth.token.email in [<email>]`.
- [ ] **Step 5: Test numerazione:** due `creaOrdine` in parallelo sull'emulatore → numeri distinti e consecutivi.
- [ ] **Step 6:** Implementare i moduli dati (transazione `runTransaction` per il contatore).
- [ ] **Step 7:** `firebase emulators:exec --only firestore "npm test"` → PASS.
- [ ] **Step 8:** Commit `feat: firebase, regole e livello dati`.

### Task 4: Login e guscio dell'app

**Files:**
- Create: `src/auth/AuthContext.tsx`, `src/pagine/Login.tsx`, `src/componenti/Guscio.tsx` (barra in basso su telefono, barra laterale su PC)
- Test: `src/auth/Login.test.tsx`

**Interfaces:**
- Produces: `useAuth(): {utente: User | null; caricamento: boolean; esci(): Promise<void>}`; componente `<RottaProtetta>`.

- [ ] **Step 1: Test che falliscono:** senza utente la rotta `/ordini` reindirizza a `/login`; credenziali errate mostrano "Email o password non corretti" (Auth mockato); login riuscito porta a `/ordini`.
- [ ] **Step 2:** `npm test` → FAIL; **Step 3:** implementare; **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: login e guscio`.

### Task 5: Clienti

**Files:** Create `src/pagine/Clienti.tsx`, `src/pagine/ClienteScheda.tsx`, `src/componenti/SelezionaCliente.tsx`; Test `src/pagine/Clienti.test.tsx`.

**Interfaces:** Consumes `ascoltaClienti`, `creaCliente`, `ascoltaOrdini`. Produces `<SelezionaCliente onScelto={(c: Cliente) => void}>` (cerca per nome/telefono, crea al volo).

- [ ] **Step 1: Test:** il riquadro "Dati di spedizione" nella scheda cliente salva destinatario, indirizzo, CAP (5 cifre), città e provincia (2 lettere) e li mostra ricaricando; CAP o provincia non validi mostrano un errore e non salvano; i campi sono facoltativi; ricerca "mar" filtra "Maria Rossi"; crea al volo un cliente con solo il nome (telefono facoltativo); scheda mostra storico ordini e totale speso (somma `versatoCent`).
- [ ] **Step 2–4:** FAIL → implementare → PASS. **Step 5:** Commit `feat: clienti`.

### Task 6: Elenco e creazione ordine

**Files:** Create `src/pagine/Ordini.tsx`, `src/pagine/OrdineForm.tsx`, `src/componenti/RigheEditor.tsx`; Test `src/pagine/OrdineForm.test.tsx`.

**Interfaces:** Consumes `creaOrdine`, `ascoltaListino`, `totaleCent`, `SelezionaCliente`. Produces rotte `/ordini` e `/ordini/nuovo`.

- [ ] **Step 1: Test:** form senza cliente o senza righe non invia; aggiungere 2 righe aggiorna il totale in tempo reale (es. `2 × 3,50 € + 1 × 10,00 € = 17,00 €`); acconto iniziale facoltativo diventa il primo pagamento; scelta dal listino precompila descrizione e prezzo ma restano modificabili; filtri lista per stato e canale.
- [ ] **Step 2–4:** FAIL → implementare (pulsante "Nuovo ordine" grande, scheda per ordine con residuo ben visibile) → PASS. **Step 5:** Commit `feat: elenco e nuovo ordine`.

### Task 7: Dettaglio ordine, pagamenti, WhatsApp, PDF

**Files:** Create `src/pagine/OrdineDettaglio.tsx`, `src/lib/pdf.ts`; Test `src/pagine/OrdineDettaglio.test.tsx`, `src/lib/pdf.test.ts`.

**Interfaces:** Consumes `aggiungiPagamento`, `aggiornaOrdine`, `linkWhatsApp`, `statoPagamento`, `daRimborsare`. Produces `generaPdfOrdine(o: Ordine): Promise<Blob>` (logo, numero, cliente, righe con testo personalizzato, totale, versato, residuo).

- [ ] **Step 1: Test:** aggiungere un secondo acconto cambia stato da `acconto` a `saldato` col saldo; senza telefono il pulsante "Invia su WhatsApp" è disabilitato con suggerimento "Aggiungi il telefono del cliente"; ordine annullato con versato mostra "Da rimborsare"; `generaPdfOrdine` restituisce un Blob `application/pdf` non vuoto anche con testo con emoji e `&`.
- [ ] **Step 2–4:** FAIL → implementare (jsPDF; caratteri non supportati sostituiti in modo sicuro, non devono bloccare la generazione) → PASS. **Step 5:** Commit `feat: dettaglio ordine, pagamenti, whatsapp e pdf`.

### Task 8: Incassi

**Files:** Create `src/pagine/Incassi.tsx`; Test `src/pagine/Incassi.test.tsx`.

**Interfaces:** Consumes `incassiPerMese`, `incassiPer`, `residuoCent`, `daRimborsare`.

- [ ] **Step 1: Test:** con dati noti mostra totale del periodo, ripartizione per canale e per metodo, residuo complessivo da incassare (escludendo annullati) e avviso dei rimborsi; cambio periodo aggiorna i numeri.
- [ ] **Step 2–4:** FAIL → implementare (barre semplici in CSS, nessuna libreria grafica) → PASS. **Step 5:** Commit `feat: riepilogo incassi`.

### Task 9: Listino

**Files:** Create `src/pagine/Listino.tsx`; Test `src/pagine/Listino.test.tsx`.

- [ ] **Step 1: Test:** aggiunta, modifica prezzo e disattivazione di una voce; le voci disattivate non compaiono nel selettore dell'ordine.
- [ ] **Step 2–4:** FAIL → implementare → PASS. **Step 5:** Commit `feat: listino`.

### Task 10: Pubblicazione e verifica finale

**Files:** Modify `firebase.json` se serve; Create `README.md` (uso, creare utenti, deploy).

- [ ] **Step 1:** Creare gli utenti con la CLI/console (`firebase auth:import` o console), email dal Task 3.
- [ ] **Step 2:** `npm test`, `npm run build`, emulatore delle regole → tutto PASS.
- [ ] **Step 3:** `firebase deploy` (hosting + firestore:rules + indexes); aprire l'URL pubblicato.
- [ ] **Step 4 (browser, due larghezze: 375 px e desktop):** login, crea cliente, crea ordine con acconto, aggiungi secondo acconto, apri il link WhatsApp, scarica il PDF, controlla Incassi; console senza errori; installabile come PWA.
- [ ] **Step 5:** Cancello di revisione (security-review, simplify, code-review, secondo parere DeepSeek sulle regole Firestore e sul calcolo incassi, senza dati reali).
- [ ] **Step 6:** Commit `docs: readme e rilascio`, push su `origin main` solo su richiesta dell'utente.
