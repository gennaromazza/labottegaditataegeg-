/**
 * Un finto Firestore in memoria, solo per i test: fa girare il codice vero di src/data/* senza emulatore (che richiede Java).
 * Imita le regole di Firestore che contano per le transazioni:
 *  - nelle transazioni tutte le letture vanno fatte PRIMA delle scritture;
 *  - i valori `undefined` non sono ammessi;
 *  - `update` su un documento che non esiste è un errore;
 *  - se la transazione fallisce non si scrive niente.
 */
type Dati = Record<string, unknown>

export const archivio = new Map<string, Dati>()
let contatore = 0

export function azzera() {
  archivio.clear()
  contatore = 0
}

export function inserisci(percorso: string, dati: Dati) {
  archivio.set(percorso, structuredClone(dati))
}

export const leggi = (percorso: string): Dati | undefined => (archivio.has(percorso) ? structuredClone(archivio.get(percorso)) : undefined)
export const elenco = (collezione: string): (Dati & { _id: string })[] =>
  [...archivio.entries()].filter(([p]) => p.startsWith(`${collezione}/`)).map(([p, d]) => ({ ...structuredClone(d), _id: p.slice(collezione.length + 1) }))

export const db = {}

// ---- ascoltatori (servono alle prove nel browser: le schermate si aggiornano da sole come con Firestore vero) ----
const ascoltatori = new Set<() => void>()
const notifica = () => ascoltatori.forEach((f) => f())


interface Rif {
  tipo: 'collezione' | 'doc'
  path: string
  id: string
}

export const collection = (_db: unknown, nome: string): Rif => ({ tipo: 'collezione', path: nome, id: nome })

export function doc(a: unknown, nome?: string, id?: string): Rif {
  const prima = a as Rif
  if (prima.tipo === 'collezione') {
    contatore += 1
    const nuovoId = `auto${contatore}`
    return { tipo: 'doc', path: `${prima.path}/${nuovoId}`, id: nuovoId }
  }
  return { tipo: 'doc', path: `${nome}/${id}`, id: id! }
}

const CANCELLA = { __cancella: true }
export const deleteField = () => CANCELLA

function contieneUndefined(v: unknown): boolean {
  if (v === undefined) return true
  if (Array.isArray(v)) return v.some(contieneUndefined)
  if (v && typeof v === 'object' && v !== CANCELLA) return Object.values(v).some(contieneUndefined)
  return false
}

function controlla(dati: Dati) {
  if (contieneUndefined(dati)) throw new Error('Firestore: valore undefined non ammesso')
}

function applica(vecchio: Dati, patch: Dati): Dati {
  const nuovo: Dati = { ...vecchio }
  for (const [k, v] of Object.entries(patch)) {
    if (v === CANCELLA) delete nuovo[k]
    else nuovo[k] = structuredClone(v)
  }
  return nuovo
}

export async function runTransaction<T>(_db: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> {
  let scritto = false
  const scritture: (() => void)[] = []
  const tx = {
    async get(ref: Rif) {
      if (scritto) throw new Error('Firestore: le letture di una transazione vanno fatte prima di tutte le scritture')
      const d = archivio.get(ref.path)
      return { id: ref.id, exists: () => d !== undefined, data: () => (d ? structuredClone(d) : undefined) }
    },
    update(ref: Rif, patch: Dati) {
      scritto = true
      controlla(patch)
      scritture.push(() => {
        const d = archivio.get(ref.path)
        if (!d) throw new Error(`Firestore: update su documento inesistente (${ref.path})`)
        archivio.set(ref.path, applica(d, patch))
      })
    },
    set(ref: Rif, dati: Dati, opzioni?: { merge?: boolean }) {
      scritto = true
      controlla(dati)
      scritture.push(() => archivio.set(ref.path, opzioni?.merge ? applica(archivio.get(ref.path) ?? {}, dati) : structuredClone(dati)))
    },
    delete(ref: Rif) {
      scritto = true
      scritture.push(() => void archivio.delete(ref.path))
    },
  }
  const risultato = await fn(tx)
  const copia = new Map([...archivio].map(([k, v]) => [k, structuredClone(v)]))
  try {
    scritture.forEach((f) => f())
    notifica()
  } catch (e) {
    archivio.clear()
    copia.forEach((v, k) => archivio.set(k, v))
    throw e
  }
  return risultato
}

export async function updateDoc(ref: Rif, patch: Dati) {
  controlla(patch)
  const d = archivio.get(ref.path)
  if (!d) throw new Error(`Firestore: update su documento inesistente (${ref.path})`)
  archivio.set(ref.path, applica(d, patch))
  notifica()
}

export async function addDoc(coll: Rif, dati: Dati) {
  controlla(dati)
  contatore += 1
  const id = `auto${contatore}`
  archivio.set(`${coll.path}/${id}`, structuredClone(dati))
  notifica()
  return { id }
}

export async function deleteDoc(ref: Rif) {
  archivio.delete(ref.path)
  notifica()
}

interface Vincolo {
  tipo: 'where' | 'orderBy'
  campo: string
  op?: string
  valore?: unknown
  dir?: 'asc' | 'desc'
}
interface Interrogazione {
  tipo: 'query'
  coll: Rif
  vincoli: Vincolo[]
}

export const where = (campo: string, op: string, valore: unknown): Vincolo => ({ tipo: 'where', campo, op, valore })
export const orderBy = (campo: string, dir: 'asc' | 'desc' = 'asc'): Vincolo => ({ tipo: 'orderBy', campo, dir })
export const query = (coll: Rif, ...vincoli: Vincolo[]): Interrogazione => ({ tipo: 'query', coll, vincoli })

function risultati(q: Interrogazione) {
  let righe = [...archivio.entries()]
    .filter(([p]) => p.startsWith(`${q.coll.path}/`) && !p.slice(q.coll.path.length + 1).includes('/'))
    .map(([p, d]) => ({ id: p.slice(q.coll.path.length + 1), dati: d }))
  for (const v of q.vincoli) {
    if (v.tipo === 'where' && v.op === '==') righe = righe.filter((r) => r.dati[v.campo] === v.valore)
    if (v.tipo === 'orderBy') {
      const verso = v.dir === 'desc' ? -1 : 1
      righe = righe.sort((a, b) => {
        const x = a.dati[v.campo] as string | number
        const y = b.dati[v.campo] as string | number
        return (x < y ? -1 : x > y ? 1 : 0) * verso
      })
    }
  }
  return righe
}

/** Ascolta un documento o una interrogazione: avvisa subito e a ogni scrittura. */
export function onSnapshot(bersaglio: Rif | Interrogazione, cb: (s: unknown) => void): () => void {
  const invia = () => {
    if ((bersaglio as Interrogazione).tipo === 'query') {
      const righe = risultati(bersaglio as Interrogazione)
      cb({ docs: righe.map((r) => ({ id: r.id, data: () => structuredClone(r.dati) })) })
    } else {
      const rif = bersaglio as Rif
      const d = archivio.get(rif.path)
      cb({ id: rif.id, exists: () => d !== undefined, data: () => (d ? structuredClone(d) : undefined) })
    }
  }
  ascoltatori.add(invia)
  invia()
  return () => void ascoltatori.delete(invia)
}
