import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OrdineCard } from '../componenti/OrdineCard'
import { MostraAltri, usePaginazione } from '../componenti/Paginazione'
import { Sezione } from '../componenti/Sezione'
import { ascoltaOrdini } from '../data/ordini'
import { residuoCent } from '../lib/calcoli'
import { normalizza } from '../lib/testo'
import { CANALI, ETICHETTE_STATO, STATI, type Canale, type Ordine, type StatoOrdine } from '../lib/tipi'

type FiltroPagamento = '' | 'da-incassare' | 'saldati'
type Scorciatoia = 'tutti' | 'da-incassare' | 'attesa' | 'spediti'

const LAVORAZIONE: StatoOrdine[] = ['confermato', 'in preparazione', 'pronto']

/** I filtri stanno nell'indirizzo (?stato=spedito&pagamento=da-incassare&cliente=…): le altre schermate possono rimandare qui già filtrati. */
export default function Ordini() {
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [params, setParams] = useSearchParams()
  const [ricerca, setRicerca] = useState('')

  useEffect(() => ascoltaOrdini(setOrdini), [])

  const statoParam = params.get('stato') ?? ''
  const stato = (STATI as string[]).includes(statoParam) ? (statoParam as StatoOrdine) : ''
  const canaleParam = params.get('canale') ?? ''
  const canale = (CANALI as string[]).includes(canaleParam) ? (canaleParam as Canale) : ''
  const pagamentoParam = params.get('pagamento')
  const pagamento: FiltroPagamento = pagamentoParam === 'da-incassare' || pagamentoParam === 'saldati' ? pagamentoParam : ''
  const cliente = params.get('cliente') ?? ''

  function imposta(modifiche: Record<string, string>) {
    const nuovi = new URLSearchParams(params)
    for (const [chiave, valore] of Object.entries(modifiche)) {
      if (valore) nuovi.set(chiave, valore)
      else nuovi.delete(chiave)
    }
    setParams(nuovi, { replace: true })
  }

  // le scorciatoie contano gli ordini del cliente scelto (se c'è), prima degli altri filtri
  const base = cliente ? ordini.filter((o) => o.clienteId === cliente) : ordini
  const daIncassare = (o: Ordine) => o.stato !== 'annullato' && residuoCent(o) > 0
  const conteggi = {
    tutti: base.length,
    'da-incassare': base.filter(daIncassare).length,
    attesa: base.filter((o) => o.stato === 'in attesa acconto').length,
    spediti: base.filter((o) => o.stato === 'spedito').length,
  }
  const daLavorare = base.filter((o) => LAVORAZIONE.includes(o.stato)).length

  const attiva: Scorciatoia | null =
    !stato && !pagamento ? 'tutti'
    : !stato && pagamento === 'da-incassare' ? 'da-incassare'
    : stato === 'in attesa acconto' && !pagamento ? 'attesa'
    : stato === 'spedito' && !pagamento ? 'spediti'
    : null

  const scegli = (s: Scorciatoia) =>
    imposta({
      stato: s === 'attesa' ? 'in attesa acconto' : s === 'spediti' ? 'spedito' : '',
      pagamento: s === 'da-incassare' ? 'da-incassare' : '',
    })

  const q = normalizza(ricerca).replace(/^n\.?\s*/, '')
  const visibili = base.filter((o) => {
    if (stato && o.stato !== stato) return false
    if (canale && o.canale !== canale) return false
    if (pagamento === 'da-incassare' && !daIncassare(o)) return false
    if (pagamento === 'saldati' && (o.stato === 'annullato' || residuoCent(o) > 0)) return false
    if (q && !normalizza(o.clienteNome).includes(q) && !String(o.numero).includes(q)) return false
    return true
  })

  const { visibili: pagina, resto, mostraAltri } = usePaginazione(visibili, 15, [stato, canale, pagamento, cliente, ricerca].join('|'))

  const nomeCliente = cliente ? (ordini.find((o) => o.clienteId === cliente)?.clienteNome ?? 'cliente scelto') : ''
  const descrizioneFiltri = [
    nomeCliente,
    stato ? ETICHETTE_STATO[stato] : '',
    canale,
    pagamento === 'da-incassare' ? 'da incassare' : pagamento === 'saldati' ? 'saldati' : '',
    ricerca.trim() ? `"${ricerca.trim()}"` : '',
  ].filter(Boolean)

  const SCORCIATOIE: { id: Scorciatoia; testo: string }[] = [
    { id: 'tutti', testo: 'Tutti' },
    { id: 'da-incassare', testo: 'Da incassare' },
    { id: 'attesa', testo: 'In attesa di acconto' },
    { id: 'spediti', testo: 'Spediti' },
  ]

  return (
    <main className="pagina">
      <div className="solo-stampa intestazione-stampa">
        <img src="/logo.png" alt="" />
        <strong>Tratti di Bottega · Elenco ordini{descrizioneFiltri.length ? ` · ${descrizioneFiltri.join(' · ')}` : ''}</strong>
      </div>
      <div className="riga no-stampa">
        <h1>Ordini</h1>
        <button type="button" className="secondario" onClick={() => window.print()}>Stampa elenco</button>
      </div>

      {cliente && (
        <p className="avviso no-stampa" role="status">
          Solo gli ordini di <strong>{nomeCliente}</strong>. <Link to="/ordini">Mostra tutti</Link> · <Link to={`/clienti/${encodeURIComponent(cliente)}`}>Apri la scheda</Link>
        </p>
      )}

      <div className="no-stampa">
        <label htmlFor="cerca-ordini">Cerca per cliente o numero</label>
        <input id="cerca-ordini" autoComplete="off" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
      </div>

      <div className="linguette no-stampa" role="group" aria-label="Scorciatoie" style={{ marginTop: '.75rem' }}>
        {SCORCIATOIE.map((s) => (
          <button key={s.id} type="button" aria-pressed={attiva === s.id} onClick={() => scegli(s.id)}>
            {s.testo} ({conteggi[s.id]})
          </button>
        ))}
        <Link to="/spedizioni" className="bottone secondario-link" style={{ minHeight: 44, lineHeight: '24px' }}>
          Da lavorare ({daLavorare}) →
        </Link>
      </div>

      <div className="no-stampa">
        <Sezione titolo="Altri filtri" aperta={Boolean(stato || canale || pagamento)}>
          <div className="griglia2">
            <div>
              <label htmlFor="f-stato">Stato</label>
              <select id="f-stato" value={stato} onChange={(e) => imposta({ stato: e.target.value })}>
                <option value="">Tutti</option>
                {STATI.map((s) => <option key={s} value={s}>{ETICHETTE_STATO[s]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-canale">Canale</label>
              <select id="f-canale" value={canale} onChange={(e) => imposta({ canale: e.target.value })}>
                <option value="">Tutti</option>
                {CANALI.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label htmlFor="f-pagamento">Pagamento</label>
          <select id="f-pagamento" value={pagamento} onChange={(e) => imposta({ pagamento: e.target.value })}>
            <option value="">Tutti</option>
            <option value="da-incassare">Da incassare</option>
            <option value="saldati">Saldati</option>
          </select>
        </Sezione>
      </div>

      <p className="nota no-stampa" aria-live="polite">
        {visibili.length === 1 ? '1 ordine' : `${visibili.length} ordini`}{visibili.length !== conteggi.tutti ? ` su ${conteggi.tutti}` : ''}
      </p>

      <div style={{ marginTop: '.5rem' }}>
        {visibili.length === 0 && <p>Nessun ordine.</p>}
        {pagina.map((o) => <OrdineCard key={o.id} ordine={o} />)}
        <MostraAltri resto={resto} onClick={mostraAltri} />
      </div>
      <Link to="/ordini/nuovo" className="bottone fab">+ Nuovo ordine</Link>
    </main>
  )
}
