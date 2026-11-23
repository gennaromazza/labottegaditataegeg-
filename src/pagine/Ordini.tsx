import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { OrdineCard } from '../componenti/OrdineCard'
import { ascoltaOrdini } from '../data/ordini'
import { CANALI, STATI, type Canale, type Ordine, type StatoOrdine } from '../lib/tipi'

export default function Ordini() {
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [stato, setStato] = useState<StatoOrdine | ''>('')
  const [canale, setCanale] = useState<Canale | ''>('')

  useEffect(() => ascoltaOrdini(setOrdini), [])

  const visibili = ordini.filter((o) => (!stato || o.stato === stato) && (!canale || o.canale === canale))

  return (
    <main className="pagina">
      <div className="solo-stampa intestazione-stampa">
        <img src="/logo.png" alt="" />
        <strong>La Bottega di Tata e Gegè · Elenco ordini{stato ? ` · ${stato}` : ''}{canale ? ` · ${canale}` : ''}</strong>
      </div>
      <div className="riga no-stampa">
        <h1>Ordini</h1>
        <button type="button" className="secondario" onClick={() => window.print()}>Stampa elenco</button>
      </div>
      <div className="griglia2 no-stampa">
        <div>
          <label htmlFor="f-stato">Stato</label>
          <select id="f-stato" value={stato} onChange={(e) => setStato(e.target.value as StatoOrdine | '')}>
            <option value="">Tutti</option>
            {STATI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-canale">Canale</label>
          <select id="f-canale" value={canale} onChange={(e) => setCanale(e.target.value as Canale | '')}>
            <option value="">Tutti</option>
            {CANALI.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {visibili.length === 0 && <p>Nessun ordine.</p>}
        {visibili.map((o) => <OrdineCard key={o.id} ordine={o} />)}
      </div>
      <Link to="/ordini/nuovo" className="bottone fab">+ Nuovo ordine</Link>
    </main>
  )
}
