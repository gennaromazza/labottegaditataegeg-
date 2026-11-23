import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ascoltaOrdini } from '../data/ordini'
import { oggiISO } from '../data/util'
import { daRimborsare, formatEuro, incassiPer, incassiPerMese, residuoCent, versatoCent } from '../lib/calcoli'
import type { Ordine } from '../lib/tipi'

function Barre({ voci }: { voci: { chiave: string; totaleCent: number }[] }) {
  const max = Math.max(1, ...voci.map((v) => v.totaleCent))
  if (voci.length === 0) return <p>Nessun incasso nel periodo.</p>
  return (
    <div>
      {voci
        .slice()
        .sort((a, b) => b.totaleCent - a.totaleCent)
        .map((v) => (
          <div key={v.chiave} style={{ marginBottom: '.6rem' }}>
            <div className="riga"><span>{v.chiave}</span><strong>{formatEuro(v.totaleCent)}</strong></div>
            <div className="barra" style={{ width: `${Math.max(2, (v.totaleCent / max) * 100)}%` }} />
          </div>
        ))}
    </div>
  )
}

export default function Incassi() {
  const oggi = oggiISO()
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [da, setDa] = useState(`${oggi.slice(0, 7)}-01`)
  const [a, setA] = useState(oggi)

  useEffect(() => ascoltaOrdini(setOrdini), [])

  const perCanale = incassiPer(ordini, 'canale', da, a)
  const perMetodo = incassiPer(ordini, 'metodo', da, a)
  const totalePeriodo = perCanale.reduce((s, v) => s + v.totaleCent, 0)
  const mensile = incassiPerMese(ordini)
  const daIncassare = ordini.filter((o) => o.stato !== 'annullato' && residuoCent(o) > 0).reduce((s, o) => s + residuoCent(o), 0)
  const rimborsi = ordini.filter(daRimborsare)

  return (
    <main className="pagina">
      <h1>Incassi</h1>
      <div className="griglia2">
        <div>
          <label htmlFor="inc-da">Dal</label>
          <input id="inc-da" type="date" value={da} onChange={(e) => setDa(e.target.value)} />
        </div>
        <div>
          <label htmlFor="inc-a">Al</label>
          <input id="inc-a" type="date" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
      </div>

      <section className="scheda">
        <div>Incassato nel periodo</div>
        <h2 data-testid="totale-periodo">{formatEuro(totalePeriodo)}</h2>
      </section>
      <section className="scheda">
        <div>Ancora da incassare (ordini non annullati)</div>
        <h2 data-testid="da-incassare">{formatEuro(daIncassare)}</h2>
      </section>

      {rimborsi.length > 0 && (
        <section className="scheda">
          <h2>Da rimborsare</h2>
          {rimborsi.map((o) => (
            <div className="riga" key={o.id}>
              <Link to={`/ordini/${o.id}`}>Ordine n. {o.numero} · {o.clienteNome}</Link>
              <strong>{formatEuro(versatoCent(o))}</strong>
            </div>
          ))}
        </section>
      )}

      <section className="scheda"><h2>Per canale</h2><Barre voci={perCanale} /></section>
      <section className="scheda"><h2>Per metodo di pagamento</h2><Barre voci={perMetodo} /></section>
      <section className="scheda">
        <h2>Mese per mese</h2>
        <Barre voci={mensile.map((m) => ({ chiave: m.mese, totaleCent: m.totaleCent }))} />
      </section>
    </main>
  )
}
