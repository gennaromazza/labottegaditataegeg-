import { collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { ErroreRegola, normalizzaStato, rimozionePermessa, statoDopoNuovoPagamento, statoDopoRimozionePagamento } from '../lib/stati'
import type { Ordine, Pagamento } from '../lib/tipi'
import { oggiISO, senzaUndefined } from './util'

type NuovoOrdine = Omit<Ordine, 'id' | 'numero' | 'creatoIl'>

/** Legge un ordine; gli stati vecchi ("da fare", "in lavorazione") vengono tradotti in quelli nuovi. */
const daDoc = (id: string, d: object): Ordine => {
  const o = { id, ...(d as Omit<Ordine, 'id'>) } as Ordine
  const versato = (o.pagamenti ?? []).reduce((s, p) => s + p.importoCent, 0)
  return { ...o, pagamenti: o.pagamenti ?? [], stato: normalizzaStato(o.stato as string, versato) }
}

const somma = (p: Pagamento[]) => p.reduce((s, x) => s + x.importoCent, 0)

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

/** Read-modify-write in transazione, così due acconti uguali non si fondono e nessuno si perde. */
export async function aggiungiPagamento(id: string, p: Pagamento): Promise<void> {
  const ref = doc(db, 'ordini', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const attuali = (snap.data()?.pagamenti as Pagamento[] | undefined) ?? []
    const nuovi = [...attuali, senzaUndefined(p)]
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
    tx.update(ref, { pagamenti: rimasti, ...(stato ? { stato } : {}) })
  })
}

export async function eliminaOrdine(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ordini', id))
}

export function ascoltaOrdini(cb: (ordini: Ordine[]) => void): () => void {
  return onSnapshot(query(collection(db, 'ordini'), orderBy('numero', 'desc')), (s) =>
    cb(s.docs.map((d) => daDoc(d.id, d.data()))),
  )
}

export function ascoltaOrdine(id: string, cb: (o: Ordine | null) => void): () => void {
  return onSnapshot(doc(db, 'ordini', id), (d) => cb(d.exists() ? daDoc(d.id, d.data()) : null))
}
