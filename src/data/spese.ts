import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { Spesa } from '../lib/tipi'
import { senzaUndefined } from './util'

export async function creaSpesa(dati: Omit<Spesa, 'id'>): Promise<void> {
  await addDoc(collection(db, 'spese'), { ...senzaUndefined(dati), creatoIl: new Date().toISOString() })
}

export async function eliminaSpesa(id: string): Promise<void> {
  await deleteDoc(doc(db, 'spese', id))
}

export function ascoltaSpese(cb: (spese: Spesa[]) => void): () => void {
  return onSnapshot(query(collection(db, 'spese'), orderBy('data', 'desc')), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Spesa, 'id'>) }))),
  )
}
