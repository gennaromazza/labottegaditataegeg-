import { useEffect, useState } from 'react'
import { ascoltaMovimenti, registraMovimento } from '../data/magazzino'
import { formatData } from '../lib/calcoli'
import { testoMovimento } from '../lib/magazzino'
import { ErroreRegola } from '../lib/stati'
import type { Articolo, Movimento, TipoMovimento } from '../lib/tipi'
import { parseQuantita, type Unita } from '../lib/unita'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

function aiutoQuantita(unita: Unita): string {
  if (unita === 'kg' || unita === 'l') return 'un numero, anche con 3 decimali (es. 1,25)'
  if (unita === 'm') return 'un numero, anche con 2 decimali (es. 1,5)'
  return 'un numero intero'
}

function Storico({ articoloId }: { articoloId: string }) {
  const [movimenti, setMovimenti] = useState<Movimento[] | null>(null)
  useEffect(() => ascoltaMovimenti(articoloId, setMovimenti), [articoloId])

  return (
    <section aria-label="Storico">
      <h3>Storico</h3>
      {movimenti === null && <p>Carico…</p>}
      {movimenti?.length === 0 && <p>Nessun movimento registrato.</p>}
      {movimenti?.map((m) => (
        <p key={m.id} className="movimento">
          <strong>{testoMovimento(m)}</strong>
          <br />
          <small>{formatData(m.data)}{m.nota ? ` · ${m.nota}` : ''}</small>
        </p>
      ))}
    </section>
  )
}

/** Carico, scarico e correzione della giacenza di un articolo, con lo storico. */
export function MovimentoArticolo({ articolo }: { articolo: Articolo }) {
  const [quantita, setQuantita] = useState('')
  const [nota, setNota] = useState('')
  const [errore, setErrore] = useState('')
  const [fatto, setFatto] = useState(false)
  const [invio, setInvio] = useState(false)

  async function registra(tipo: TipoMovimento) {
    setFatto(false)
    const q = parseQuantita(quantita, articolo.unita)
    if (q === null) return setErrore(`Scrivi una quantità valida in ${articolo.unita}: ${aiutoQuantita(articolo.unita)}.`)
    setErrore('')
    setInvio(true)
    try {
      await registraMovimento(articolo.id, tipo, q, nota)
      setQuantita('')
      setNota('')
      setFatto(true)
    } catch (e) {
      setErrore(e instanceof ErroreRegola ? e.message : ERRORE_SCRITTURA)
    } finally {
      setInvio(false)
    }
  }

  const idq = `q-${articolo.id}`
  const idn = `n-${articolo.id}`
  return (
    <div>
      <h3>Movimenti</h3>
      <label htmlFor={idq}>Quantità (in {articolo.unita})</label>
      <input id={idq} inputMode="decimal" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
      <label htmlFor={idn}>Nota (facoltativa)</label>
      <input id={idn} value={nota} placeholder="Es. acquisto dal fornitore, candela per Maria…" onChange={(e) => setNota(e.target.value)} />
      {errore && <p className="errore" role="alert">{errore}</p>}
      {fatto && <p role="status">Movimento registrato</p>}
      <div className="azioni">
        <button type="button" disabled={invio} onClick={() => void registra('carico')}>Aggiungi (carico)</button>
        <button type="button" className="secondario" disabled={invio} onClick={() => void registra('scarico')}>Togli (scarico)</button>
        <button type="button" className="secondario" disabled={invio} onClick={() => void registra('rettifica')}>Imposta giacenza</button>
      </div>
      <p className="nota">«Imposta giacenza» serve dopo un inventario: scrivi quanto ne hai davvero e il magazzino si allinea.</p>
      <Storico articoloId={articolo.id} />
    </div>
  )
}
