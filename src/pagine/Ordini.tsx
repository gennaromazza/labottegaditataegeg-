import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgePagamento } from '../componenti/BadgePagamento'
import { ascoltaOrdini } from '../data/ordini'
import { formatData, formatEuro, residuoCent, totaleCent } from '../lib/calcoli'
import { CANALI, STATI, type Canale, type Ordine, type StatoOrdine } from '../lib/tipi'

export default function Ordini() {
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [stato, setStato] = useState<StatoOrdine | ''>('')
  const [canale, setCanale] = useState<Canale | ''>('')

  useEffect(() => ascoltaOrdini(setOrdini), [])

  const visibili = ordini.filter((o) => (!stato || o.stato === stato) && (!canale || o.canale === canale))

  return (
    <main className="pagina">
      <h1>Ordini</h1>
      <div className="griglia2">
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
        {visibili.map((o) => (
          <Link key={o.id} to={`/ordini/${o.id}`} className="scheda link-scheda">
            <div className="riga">
              <strong>n. {o.numero} · {o.clienteNome}</strong>
              <span className="badge">{o.stato}</span>
            </div>
            <div className="riga">
              <span>{o.canale}{o.dataConsegna ? ` · consegna ${formatData(o.dataConsegna)}` : ''}</span>
              <BadgePagamento ordine={o} />
            </div>
            <div className="riga">
              <span>Totale {formatEuro(totaleCent(o.righe))}</span>
              <strong>{residuoCent(o) > 0 ? `Da incassare ${formatEuro(residuoCent(o))}` : ''}</strong>
            </div>
          </Link>
        ))}
      </div>
      <Link to="/ordini/nuovo" className="bottone fab">+ Nuovo ordine</Link>
    </main>
  )
}
