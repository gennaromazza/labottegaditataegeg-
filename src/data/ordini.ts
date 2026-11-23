import { collection, doc, onSnapshot, orderBy, query, runTransaction, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Ordine, Pagamento } from '../lib/tipi'
import { oggiISO, senzaUndefined } from './util'

type NuovoOrdine = Omit<Ordine, 'id' | 'numero' | 'creatoIl'>

const daDoc = (id: string, d: object) => ({ id, ...(d as Omit<Ordine, 'id'>) }) as Ordine

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
    tx.update(ref, { pagamenti: [...attuali, senzaUndefined(p)] })
  })
}

export async function rimuoviPagamento(id: string, indice: number): Promise<void> {
  const ref = doc(db, 'ordini', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const attuali = (snap.data()?.pagamenti as Pagamento[] | undefined) ?? []
    tx.update(ref, { pagamenti: attuali.filter((_, i) => i !== indice) })
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
