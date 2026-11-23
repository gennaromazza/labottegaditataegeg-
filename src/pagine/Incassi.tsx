import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Barre } from '../componenti/Barre'
import { ascoltaOrdini } from '../data/ordini'
import { ascoltaSpese } from '../data/spese'
import { oggiISO } from '../data/util'
import {
  daRimborsare,
  formatEuro,
  incassiPer,
  incassiPerMese,
  residuoCent,
  totaleIncassi,
  totaleSpese,
  utileCent,
  versatoCent,
} from '../lib/calcoli'
import type { Ordine, Spesa } from '../lib/tipi'

export default function Incassi() {
  const oggi = oggiISO()
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [spese, setSpese] = useState<Spesa[]>([])
  const [da, setDa] = useState(`${oggi.slice(0, 7)}-01`)
  const [a, setA] = useState(oggi)

  useEffect(() => ascoltaOrdini(setOrdini), [])
  useEffect(() => ascoltaSpese(setSpese), [])

  const perCanale = incassiPer(ordini, 'canale', da, a)
  const perMetodo = incassiPer(ordini, 'metodo', da, a)
  const mensile = incassiPerMese(ordini)
  const daIncassare = ordini.filter((o) => o.stato !== 'annullato' && residuoCent(o) > 0).reduce((s, o) => s + residuoCent(o), 0)
  const rimborsi = ordini.filter(daRimborsare)
  const utile = utileCent(ordini, spese, da, a)

  return (
    <main className="pagina">
      <h1>Incassi e utile</h1>
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
        <h2 data-testid="totale-periodo">{formatEuro(totaleIncassi(ordini, da, a))}</h2>
      </section>
      <section className="scheda">
        <div>Spese nel periodo (<Link to="/spese">dettaglio</Link>)</div>
        <h2 data-testid="spese-periodo">{formatEuro(totaleSpese(spese, da, a))}</h2>
      </section>
      <section className="scheda">
        <div>Utile del periodo (incassi meno spese)</div>
        <h2 data-testid="utile-periodo" className={utile < 0 ? 'errore' : ''}>{formatEuro(utile)}</h2>
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

      <section className="scheda"><h2>Per canale</h2><Barre voci={perCanale} vuoto="Nessun incasso nel periodo." /></section>
      <section className="scheda"><h2>Per metodo di pagamento</h2><Barre voci={perMetodo} vuoto="Nessun incasso nel periodo." /></section>
      <section className="scheda">
        <h2>Mese per mese</h2>
        <Barre voci={mensile.map((m) => ({ chiave: m.mese, totaleCent: m.totaleCent }))} vuoto="Nessun incasso." />
      </section>
    </main>
  )
}
