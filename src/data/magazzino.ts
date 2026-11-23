import { addDoc, collection, doc, onSnapshot, orderBy, query, runTransaction, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { calcolaMovimento, daArticolo } from '../lib/magazzino'
import { ErroreRegola } from '../lib/stati'
import type { Articolo, Movimento, TipoMovimento } from '../lib/tipi'
import { oggiISO, senzaUndefined } from './util'

/** La collezione si chiama ancora "listino" (nome storico): contiene gli articoli del magazzino, così i dati esistenti restano validi. */
const ARTICOLI = 'listino'
const MOVIMENTI = 'movimenti'

export function ascoltaArticoli(cb: (articoli: Articolo[]) => void): () => void {
  return onSnapshot(query(collection(db, ARTICOLI), orderBy('nome')), (s) =>
    cb(s.docs.map((d) => daArticolo(d.id, d.data()))),
  )
}

/** Crea l'articolo con giacenza 0; se c'è una giacenza iniziale la registra come primo carico (così compare nello storico). */
export async function creaArticolo(dati: Omit<Articolo, 'id' | 'giacenza'>, giacenzaIniziale = 0): Promise<string> {
  const ref = await addDoc(collection(db, ARTICOLI), senzaUndefined({ ...dati, giacenza: 0 }))
  if (giacenzaIniziale > 0) await registraMovimento(ref.id, 'carico', giacenzaIniziale, 'Giacenza iniziale')
  return ref.id
}

/** Modifica i dati dell'articolo. La giacenza non si tocca da qui: solo con i movimenti. */
export async function aggiornaArticolo(id: string, patch: Partial<Omit<Articolo, 'id' | 'giacenza'>>): Promise<void> {
  await updateDoc(doc(db, ARTICOLI, id), senzaUndefined(patch))
}

/**
 * Carico, scarico o correzione: aggiorna la giacenza e scrive il movimento nella stessa transazione,
 * così con due persone insieme i conti restano giusti. Uno scarico oltre la giacenza viene rifiutato.
 */
export async function registraMovimento(articoloId: string, tipo: TipoMovimento, quantitaBase: number, nota?: string): Promise<void> {
  const ref = doc(db, ARTICOLI, articoloId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new ErroreRegola('Articolo non trovato: forse è stato tolto.')
    const articolo = daArticolo(snap.id, snap.data())
    const esito = calcolaMovimento(articolo.giacenza, tipo, quantitaBase, articolo.unita)
    if (!esito.ok) throw new ErroreRegola(esito.motivo)
    tx.update(ref, { giacenza: esito.nuova })
    tx.set(
      doc(collection(db, MOVIMENTI)),
      senzaUndefined({
        articoloId,
        articoloNome: articolo.nome,
        tipo,
        delta: esito.delta,
        giacenzaDopo: esito.nuova,
        unita: articolo.unita,
        ...(nota?.trim() ? { nota: nota.trim() } : {}),
        data: oggiISO(),
        creatoIl: new Date().toISOString(),
      }),
    )
  })
}

/** Gli ultimi movimenti di un articolo, dal più recente. L'ordine si fa qui per non richiedere un indice a Firestore. */
export function ascoltaMovimenti(articoloId: string, cb: (movimenti: Movimento[]) => void, massimo = 30): () => void {
  return onSnapshot(query(collection(db, MOVIMENTI), where('articoloId', '==', articoloId)), (s) =>
    cb(
      s.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Movimento, 'id'>) }))
        .sort((a, b) => b.creatoIl.localeCompare(a.creatoIl))
        .slice(0, massimo),
    ),
  )
}
