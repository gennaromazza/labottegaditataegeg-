import { collection, deleteField, doc, onSnapshot, orderBy, query, runTransaction, updateDoc, type Transaction } from 'firebase/firestore'
import { db } from '../firebase'
import { ErroreMateriali, deveRipristinare, fabbisogno, pianoModifica, pianoScarico, righeCambiate, vociDaRipristinare, verificaDisponibilita } from '../lib/ricette'
import { formatEuro, totaleOrdineCent } from '../lib/calcoli'
import { formatQuantitaComoda } from '../lib/unita'
import { ErroreRegola, normalizzaStato, rimozionePermessa, statoDopoNuovoPagamento, statoDopoRimozionePagamento } from '../lib/stati'
import type { Articolo, Canale, Ordine, Pagamento, Riga, ScaricoMagazzino, StatoOrdine } from '../lib/tipi'
import { leggiArticoli, scriviMovimento } from './magazzino'
import { oggiISO, senzaUndefined } from './util'

type NuovoOrdine = Omit<Ordine, 'id' | 'numero' | 'creatoIl'>

/** Legge un ordine; gli stati vecchi ("da fare", "in lavorazione") vengono tradotti in quelli nuovi. */
const daDoc = (id: string, d: object): Ordine => {
  const o = { id, ...(d as Omit<Ordine, 'id'>) } as Ordine
  const versato = (o.pagamenti ?? []).reduce((s, p) => s + p.importoCent, 0)
  return { ...o, pagamenti: o.pagamenti ?? [], stato: normalizzaStato(o.stato as string, versato) }
}

const somma = (p: Pagamento[]) => p.reduce((s, x) => s + x.importoCent, 0)

/** Restituisce al magazzino i materiali che erano stati scalati per l'ordine (da chiamare quando tutte le letture sono finite). */
function restituisciMateriali(tx: Transaction, numero: number, scarico: ScaricoMagazzino | undefined, materiali: Map<string, Articolo>, motivo: string) {
  for (const v of vociDaRipristinare(scarico)) {
    const m = materiali.get(v.articoloId)
    if (!m) continue // il materiale non esiste più: niente da rimettere
    scriviMovimento(tx, m, 'carico', v.scalata, m.giacenza + v.scalata, `Ordine n. ${numero}: materiali restituiti (${motivo})`)
  }
}

const idMateriali = (scarico: ScaricoMagazzino | undefined) => vociDaRipristinare(scarico).map((v) => v.articoloId)

/** Il numero ordine è progressivo e assegnato in transazione: mai duplicato. */
export async function creaOrdine(dati: NuovoOrdine): Promise<Ordine> {
  const contatore = doc(db, 'meta', 'contatori')
  const nuovo = doc(collection(db, 'ordini'))
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(contatore)
    const numero = ((snap.data()?.ordini as number | undefined) ?? 0) + 1
    const ordine: Omit<Ordine, 'id'> = { ...dati, numero, creatoIl: oggiISO() }
    tx.set(contatore, { ordini: numero }, { merge: true })
    tx.set(nuovo, senzaUndefined(ordine))
    return { id: nuovo.id, ...ordine }
  })
}

export async function aggiornaOrdine(id: string, patch: Partial<Omit<Ordine, 'id' | 'numero'>>): Promise<void> {
  await updateDoc(doc(db, 'ordini', id), senzaUndefined(patch))
}

const MOTIVO: Partial<Record<StatoOrdine, string>> = {
  annullato: 'ordine annullato',
  'in attesa acconto': 'ordine tornato in attesa',
  confermato: 'ordine tornato indietro',
}

/**
 * Cambia lo stato di un ordine. Quando passa a "In preparazione" scala dal magazzino i materiali delle ricette
 * (una volta sola); se poi viene annullato o torna indietro prima della spedizione li restituisce.
 * Se mancano materiali lancia ErroreMateriali, a meno che `procediComunque`: allora scala quanto c'è.
 */
export async function cambiaStatoOrdine(
  id: string,
  nuovo: StatoOrdine,
  opzioni: { procediComunque?: boolean; extra?: Partial<Omit<Ordine, 'id' | 'numero'>> } = {},
): Promise<void> {
  const ref = doc(db, 'ordini', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new ErroreRegola('Ordine non trovato: forse è stato eliminato.')
    const ordine = daDoc(snap.id, snap.data())
    const extra = senzaUndefined(opzioni.extra ?? {})

    if (nuovo === 'in preparazione' && !ordine.scaricoMagazzino) {
      const prodotti = await leggiArticoli(tx, ordine.righe.flatMap((r) => (r.articoloId ? [r.articoloId] : [])))
      const ingredienti = await leggiArticoli(tx, [...prodotti.values()].flatMap((p) => p.ricetta?.map((i) => i.articoloId) ?? []))
      const tutti = [...prodotti.values(), ...ingredienti.values()]
      const f = fabbisogno(ordine.righe, tutti)
      const verifica = verificaDisponibilita(f.voci, tutti)
      if (!verifica.ok && !opzioni.procediComunque) throw new ErroreMateriali(verifica.mancanti)
      const piano = pianoScarico(f.voci, tutti)
      for (const voce of piano) {
        const m = ingredienti.get(voce.articoloId)
        if (!m || voce.scalata <= 0) continue
        const manca = voce.necessaria - voce.scalata
        scriviMovimento(tx, m, 'scarico', -voce.scalata, m.giacenza - voce.scalata, `Ordine n. ${ordine.numero}${manca > 0 ? ` (ne mancavano ${formatQuantitaComoda(manca, m.unita)})` : ''}`)
      }
      tx.update(ref, { stato: nuovo, ...extra, ...(piano.length > 0 ? { scaricoMagazzino: { data: oggiISO(), voci: piano } } : {}) })
      return
    }

    if (deveRipristinare(nuovo, ordine.scaricoMagazzino, ordine.stato)) {
      const materiali = await leggiArticoli(tx, idMateriali(ordine.scaricoMagazzino))
      restituisciMateriali(tx, ordine.numero, ordine.scaricoMagazzino, materiali, MOTIVO[nuovo] ?? 'ordine tornato indietro')
      tx.update(ref, { stato: nuovo, ...extra, scaricoMagazzino: deleteField() })
      return
    }

    tx.update(ref, { stato: nuovo, ...extra })
  })
}

export interface DatiModifica {
  clienteId: string
  clienteNome: string
  clienteTelefono?: string
  canale: Canale
  righe: Riga[]
  dataConsegna?: string
  note?: string
  costoSpedizioneCent?: number
}

/**
 * Modifica un ordine già creato (non cambiano numero, stato, pagamenti, note di preparazione).
 * I campi facoltativi lasciati vuoti vengono tolti dall'ordine.
 * Se i materiali erano già stati scalati e cambiano prodotti o quantità (prima della spedizione), il magazzino
 * si ricalcola con la differenza, nella stessa transazione; se non bastano lancia ErroreMateriali
 * a meno che `procediComunque`. Dopo la spedizione il magazzino non si tocca (la merce è partita).
 */
export async function modificaOrdine(id: string, dati: DatiModifica, opzioni: { procediComunque?: boolean } = {}): Promise<void> {
  const ref = doc(db, 'ordini', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new ErroreRegola('Ordine non trovato: forse è stato eliminato.')
    const ordine = daDoc(snap.id, snap.data())

    const patch: Record<string, unknown> = {
      clienteId: dati.clienteId,
      clienteNome: dati.clienteNome,
      canale: dati.canale,
      righe: senzaUndefined(dati.righe),
      clienteTelefono: dati.clienteTelefono ? dati.clienteTelefono : deleteField(),
      dataConsegna: dati.dataConsegna ? dati.dataConsegna : deleteField(),
      note: dati.note ? dati.note : deleteField(),
      costoSpedizioneCent: dati.costoSpedizioneCent !== undefined ? dati.costoSpedizioneCent : deleteField(),
    }

    const nuovoTotale = totaleOrdineCent({ ...ordine, righe: dati.righe, costoSpedizioneCent: dati.costoSpedizioneCent })
    const versato = somma(ordine.pagamenti)
    if (versato > nuovoTotale) {
      throw new ErroreRegola(`Hai già incassato ${formatEuro(versato)}: il totale dell'ordine non può scendere sotto questa cifra. Togli prima un pagamento.`)
    }

    const partito = ordine.stato === 'spedito' || ordine.stato === 'consegnato'
    if (ordine.scaricoMagazzino && !partito && righeCambiate(ordine.righe, dati.righe)) {
      const prodotti = await leggiArticoli(tx, dati.righe.flatMap((r) => (r.articoloId ? [r.articoloId] : [])))
      const materiali = await leggiArticoli(tx, [
        ...[...prodotti.values()].flatMap((p) => p.ricetta?.map((i) => i.articoloId) ?? []),
        ...ordine.scaricoMagazzino.voci.map((v) => v.articoloId),
      ])
      const tutti = [...prodotti.values(), ...materiali.values()]
      const piano = pianoModifica(ordine.scaricoMagazzino, fabbisogno(dati.righe, tutti).voci, tutti, Boolean(opzioni.procediComunque))
      if (!piano.ok) throw new ErroreMateriali(piano.mancanti)
      for (const v of piano.variazioni) {
        const m = materiali.get(v.articoloId)
        if (!m) continue
        scriviMovimento(tx, m, v.variazione > 0 ? 'carico' : 'scarico', v.variazione, m.giacenza + v.variazione, `Ordine n. ${ordine.numero} modificato`)
      }
      patch.scaricoMagazzino = piano.voci.length > 0 ? { data: ordine.scaricoMagazzino.data, voci: piano.voci } : deleteField()
    }

    tx.update(ref, patch)
  })
}

/** Imposta il costo di spedizione che il cliente paga (0 = gratuita); `null` toglie la riga di spedizione dall'ordine. */
export async function impostaCostoSpedizione(id: string, cent: number | null): Promise<void> {
  await updateDoc(doc(db, 'ordini', id), { costoSpedizioneCent: cent === null ? deleteField() : cent })
}

/** Read-modify-write in transazione, così due acconti uguali non si fondono e nessuno si perde. */
export async function aggiungiPagamento(id: string, p: Pagamento): Promise<void> {
  const ref = doc(db, 'ordini', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const attuali = (snap.data()?.pagamenti as Pagamento[] | undefined) ?? []
    const nuovi = [...attuali, senzaUndefined(p)]
    // un pagamento non può far superare l'importo dell'ordine
    const totale = totaleOrdineCent(daDoc(snap.id, snap.data() ?? {}))
    if (somma(nuovi) > totale) {
      const residuo = Math.max(0, totale - somma(attuali))
      throw new ErroreRegola(`L'importo supera quello che resta da pagare (${formatEuro(residuo)}).`)
    }
    // il primo acconto conferma l'ordine che stava aspettando
    const stato = statoDopoNuovoPagamento(String(snap.data()?.stato ?? ''), somma(nuovi))
    tx.update(ref, { pagamenti: nuovi, ...(stato ? { stato } : {}) })
  })
}

/** Toglie il primo pagamento uguale a quello indicato (non per posizione: se un altro utente ha già cambiato l'elenco non si cancella quello sbagliato). */
export async function rimuoviPagamento(id: string, pagamento: Pagamento): Promise<void> {
  const ref = doc(db, 'ordini', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const attuali = (snap.data()?.pagamenti as Pagamento[] | undefined) ?? []
    const posizione = attuali.findIndex(
      (x) => x.importoCent === pagamento.importoCent && x.data === pagamento.data && x.metodo === pagamento.metodo,
    )
    if (posizione < 0) return // già rimosso da un altro utente
    const rimasti = attuali.filter((_, i) => i !== posizione)
    const permesso = rimozionePermessa(String(snap.data()?.stato ?? ''), somma(rimasti))
    if (!permesso.ok) throw new ErroreRegola(permesso.motivo)
    const stato = statoDopoRimozionePagamento(String(snap.data()?.stato ?? ''), somma(rimasti))
    const scarico = snap.data()?.scaricoMagazzino as ScaricoMagazzino | undefined
    if (stato && deveRipristinare(stato, scarico)) {
      // senza acconto l'ordine torna in attesa: anche i materiali tornano in magazzino
      const materiali = await leggiArticoli(tx, idMateriali(scarico))
      restituisciMateriali(tx, Number(snap.data()?.numero ?? 0), scarico, materiali, 'pagamento tolto')
      tx.update(ref, { pagamenti: rimasti, stato, scaricoMagazzino: deleteField() })
      return
    }
    tx.update(ref, { pagamenti: rimasti, ...(stato ? { stato } : {}) })
  })
}

const PRIMA_DELLA_SPEDIZIONE: StatoOrdine[] = ['in attesa acconto', 'confermato', 'in preparazione', 'pronto']

/** Elimina l'ordine; se aveva scalato materiali e non è ancora partito li restituisce al magazzino. */
export async function eliminaOrdine(id: string): Promise<void> {
  const ref = doc(db, 'ordini', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const ordine = daDoc(snap.id, snap.data())
    if (ordine.scaricoMagazzino && PRIMA_DELLA_SPEDIZIONE.includes(ordine.stato)) {
      const materiali = await leggiArticoli(tx, idMateriali(ordine.scaricoMagazzino))
      restituisciMateriali(tx, ordine.numero, ordine.scaricoMagazzino, materiali, 'ordine eliminato')
    }
    tx.delete(ref)
  })
}

export function ascoltaOrdini(cb: (ordini: Ordine[]) => void): () => void {
  return onSnapshot(query(collection(db, 'ordini'), orderBy('numero', 'desc')), (s) =>
    cb(s.docs.map((d) => daDoc(d.id, d.data()))),
  )
}

export function ascoltaOrdine(id: string, cb: (o: Ordine | null) => void): () => void {
  return onSnapshot(doc(db, 'ordini', id), (d) => cb(d.exists() ? daDoc(d.id, d.data()) : null))
}
