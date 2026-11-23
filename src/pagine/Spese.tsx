import { useEffect, useState, type FormEvent } from 'react'
import { Barre } from '../componenti/Barre'
import { creaSpesa, eliminaSpesa, ascoltaSpese } from '../data/spese'
import { oggiISO } from '../data/util'
import { formatData, formatEuro, speseFiltrate, spesePerCategoria, totaleSpese } from '../lib/calcoli'
import { parseEuro } from '../lib/importi'
import { CATEGORIE_SPESA, type CategoriaSpesa, type Spesa } from '../lib/tipi'

const ERRORE = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

function FormSpesa() {
  const [descrizione, setDescrizione] = useState('')
  const [importo, setImporto] = useState('')
  const [data, setData] = useState(oggiISO())
  const [categoria, setCategoria] = useState<CategoriaSpesa>('Materiali')
  const [note, setNote] = useState('')
  const [errore, setErrore] = useState('')

  async function aggiungi(e: FormEvent) {
    e.preventDefault()
    const cent = parseEuro(importo)
    if (!descrizione.trim()) return setErrore('Scrivi cosa hai pagato')
    if (cent === null || cent <= 0) return setErrore('Scrivi un importo valido')
    if (!data) return setErrore('Scegli la data')
    setErrore('')
    try {
      await creaSpesa({ descrizione: descrizione.trim(), importoCent: cent, data, categoria, ...(note.trim() ? { note: note.trim() } : {}) })
      setDescrizione('')
      setImporto('')
      setNote('')
    } catch {
      setErrore(ERRORE)
    }
  }

  return (
    <form className="scheda" onSubmit={(e) => void aggiungi(e)} aria-label="Nuova spesa">
      <h2>Registra una spesa</h2>
      <label htmlFor="sp-desc">Cosa hai pagato</label>
      <input id="sp-desc" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
      <div className="griglia2">
        <div>
          <label htmlFor="sp-imp">Importo (€)</label>
          <input id="sp-imp" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sp-dat">Data</label>
          <input id="sp-dat" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <label htmlFor="sp-cat">Categoria</label>
      <select id="sp-cat" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaSpesa)}>
        {CATEGORIE_SPESA.map((c) => <option key={c}>{c}</option>)}
      </select>
      <label htmlFor="sp-note">Note (facoltative)</label>
      <input id="sp-note" value={note} onChange={(e) => setNote(e.target.value)} />
      {errore && <p className="errore" role="alert">{errore}</p>}
      <p><button type="submit">Aggiungi spesa</button></p>
    </form>
  )
}

export default function Spese() {
  const oggi = oggiISO()
  const [spese, setSpese] = useState<Spesa[]>([])
  const [da, setDa] = useState(`${oggi.slice(0, 7)}-01`)
  const [a, setA] = useState(oggi)
  const [categoria, setCategoria] = useState<CategoriaSpesa | ''>('')
  const [errore, setErrore] = useState('')

  useEffect(() => ascoltaSpese(setSpese), [])

  const visibili = speseFiltrate(spese, da, a, categoria || undefined)

  async function elimina(s: Spesa) {
    if (!window.confirm(`Eliminare la spesa "${s.descrizione}" di ${formatEuro(s.importoCent)}?`)) return
    setErrore('')
    try {
      await eliminaSpesa(s.id)
    } catch {
      setErrore(ERRORE)
    }
  }

  return (
    <main className="pagina">
      <h1>Spese</h1>
      <div className="griglia2">
        <div>
          <label htmlFor="spe-da">Dal</label>
          <input id="spe-da" type="date" value={da} onChange={(e) => setDa(e.target.value)} />
        </div>
        <div>
          <label htmlFor="spe-a">Al</label>
          <input id="spe-a" type="date" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
      </div>
      <label htmlFor="spe-cat">Categoria</label>
      <select id="spe-cat" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaSpesa | '')}>
        <option value="">Tutte</option>
        {CATEGORIE_SPESA.map((c) => <option key={c}>{c}</option>)}
      </select>

      <section className="scheda" style={{ marginTop: '1rem' }}>
        <div>Spese nel periodo</div>
        <h2 data-testid="totale-spese">{formatEuro(totaleSpese(spese, da, a))}</h2>
      </section>
      <section className="scheda">
        <div>di cui spedizioni</div>
        <h2 data-testid="totale-spedizioni">{formatEuro(totaleSpese(spese, da, a, 'Spedizioni'))}</h2>
      </section>
      <section className="scheda"><h2>Per categoria</h2><Barre voci={spesePerCategoria(spese, da, a)} vuoto="Nessuna spesa nel periodo." /></section>

      <FormSpesa />

      <h2>Elenco{categoria ? ` · ${categoria}` : ''}</h2>
      {errore && <p className="errore" role="alert">{errore}</p>}
      {visibili.length === 0 && <p>Nessuna spesa nel periodo.</p>}
      {visibili.map((s) => (
        <div className="scheda" key={s.id}>
          <div className="riga">
            <strong>{s.descrizione}</strong>
            <strong>{formatEuro(s.importoCent)}</strong>
          </div>
          <div className="riga">
            <span>{formatData(s.data)} · <span className="badge">{s.categoria}</span>{s.note ? ` · ${s.note}` : ''}</span>
            <button type="button" className="secondario" aria-label={`Elimina spesa ${s.descrizione}`} onClick={() => void elimina(s)}>Elimina</button>
          </div>
        </div>
      ))}
    </main>
  )
}
