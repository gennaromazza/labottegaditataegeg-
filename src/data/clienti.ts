import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Cliente } from '../lib/tipi'
import { senzaUndefined } from './util'

const col = () => collection(db, 'clienti')

export async function creaCliente(dati: Omit<Cliente, 'id'>): Promise<Cliente> {
  const ref = await addDoc(col(), { ...senzaUndefined(dati), creatoIl: new Date().toISOString() })
  return { id: ref.id, ...dati }
}

export async function aggiornaCliente(id: string, patch: Partial<Omit<Cliente, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'clienti', id), senzaUndefined(patch))
}

export function ascoltaClienti(cb: (clienti: Cliente[]) => void): () => void {
  return onSnapshot(query(col(), orderBy('nome')), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, 'id'>) }))),
  )
}

export function ascoltaCliente(id: string, cb: (c: Cliente | null) => void): () => void {
  return onSnapshot(doc(db, 'clienti', id), (d) =>
    cb(d.exists() ? { id: d.id, ...(d.data() as Omit<Cliente, 'id'>) } : null),
  )
}
