import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OrdineCard } from '../componenti/OrdineCard'
import { ascoltaOrdini } from '../data/ordini'
import { residuoCent } from '../lib/calcoli'
import { CANALI, ETICHETTE_STATO, STATI, type Canale, type Ordine, type StatoOrdine } from '../lib/tipi'

type FiltroPagamento = '' | 'da-incassare' | 'saldati'

/** I filtri stanno nell'indirizzo (?stato=spedito&pagamento=da-incassare): le altre schermate possono rimandare qui già filtrati. */
export default function Ordini() {
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [params, setParams] = useSearchParams()

  useEffect(() => ascoltaOrdini(setOrdini), [])

  const statoParam = params.get('stato') ?? ''
  const stato = (STATI as string[]).includes(statoParam) ? (statoParam as StatoOrdine) : ''
  const canaleParam = params.get('canale') ?? ''
  const canale = (CANALI as string[]).includes(canaleParam) ? (canaleParam as Canale) : ''
  const pagamentoParam = params.get('pagamento')
  const pagamento: FiltroPagamento = pagamentoParam === 'da-incassare' || pagamentoParam === 'saldati' ? pagamentoParam : ''

  function imposta(chiave: string, valore: string) {
    const nuovi = new URLSearchParams(params)
    if (valore) nuovi.set(chiave, valore)
    else nuovi.delete(chiave)
    setParams(nuovi, { replace: true })
  }

  const visibili = ordini.filter((o) => {
    if (stato && o.stato !== stato) return false
    if (canale && o.canale !== canale) return false
    if (pagamento === 'da-incassare') return o.stato !== 'annullato' && residuoCent(o) > 0
    if (pagamento === 'saldati') return o.stato !== 'annullato' && residuoCent(o) <= 0
    return true
  })

  const descrizioneFiltri = [
    stato ? ETICHETTE_STATO[stato] : '',
    canale,
    pagamento === 'da-incassare' ? 'da incassare' : pagamento === 'saldati' ? 'saldati' : '',
  ].filter(Boolean)

  return (
    <main className="pagina">
      <div className="solo-stampa intestazione-stampa">
        <img src="/logo.png" alt="" />
        <strong>La Bottega di Tata e Gegè · Elenco ordini{descrizioneFiltri.length ? ` · ${descrizioneFiltri.join(' · ')}` : ''}</strong>
      </div>
      <div className="riga no-stampa">
        <h1>Ordini</h1>
        <button type="button" className="secondario" onClick={() => window.print()}>Stampa elenco</button>
      </div>
      <p className="no-stampa">
        <Link to="/spedizioni" className="bottone secondario-link">Vai alle Spedizioni</Link>
      </p>
      <div className="griglia2 no-stampa">
        <div>
          <label htmlFor="f-stato">Stato</label>
          <select id="f-stato" value={stato} onChange={(e) => imposta('stato', e.target.value)}>
            <option value="">Tutti</option>
            {STATI.map((s) => <option key={s} value={s}>{ETICHETTE_STATO[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-canale">Canale</label>
          <select id="f-canale" value={canale} onChange={(e) => imposta('canale', e.target.value)}>
            <option value="">Tutti</option>
            {CANALI.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="no-stampa">
        <label htmlFor="f-pagamento">Pagamento</label>
        <select id="f-pagamento" value={pagamento} onChange={(e) => imposta('pagamento', e.target.value)}>
          <option value="">Tutti</option>
          <option value="da-incassare">Da incassare</option>
          <option value="saldati">Saldati</option>
        </select>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {visibili.length === 0 && <p>Nessun ordine.</p>}
        {visibili.map((o) => <OrdineCard key={o.id} ordine={o} />)}
      </div>
      <Link to="/ordini/nuovo" className="bottone fab">+ Nuovo ordine</Link>
    </main>
  )
}
