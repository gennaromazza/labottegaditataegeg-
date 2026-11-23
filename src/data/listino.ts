import { addDoc, collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface VoceListino {
  id: string
  nome: string
  prezzoCent: number
  attivo: boolean
}

export async function salvaVoceListino(voce: Omit<VoceListino, 'id'> & { id?: string }): Promise<void> {
  const { id, ...dati } = voce
  if (id) await setDoc(doc(db, 'listino', id), dati)
  else await addDoc(collection(db, 'listino'), dati)
}

export function ascoltaListino(cb: (voci: VoceListino[]) => void): () => void {
  return onSnapshot(query(collection(db, 'listino'), orderBy('nome')), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VoceListino, 'id'>) }))),
  )
}
