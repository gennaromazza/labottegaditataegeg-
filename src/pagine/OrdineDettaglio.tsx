import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgePagamento } from '../componenti/BadgePagamento'
import { ascoltaCliente } from '../data/clienti'
import { aggiungiPagamento, ascoltaOrdine, ascoltaOrdini, eliminaOrdine, rimuoviPagamento } from '../data/ordini'
import { oggiISO } from '../data/util'
import { formatData, formatEuro, haSpedizione, residuoCent, spedizioneCent, totaleOrdineCent, versatoCent } from '../lib/calcoli'
import { parseEuro } from '../lib/importi'
import { linkOrdine } from '../lib/link'
import { generaPdfOrdine } from '../lib/pdf'
import { linkWhatsApp, testoIndirizzo } from '../lib/whatsapp'
import { AvanzamentoOrdine } from '../componenti/AvanzamentoOrdine'
import { Briciole } from '../componenti/Briciole'
import { CostoSpedizione } from '../componenti/CostoSpedizione'
import { AvvisoMateriali, useCambioStato } from '../componenti/CambioStato'
import { Sezione } from '../componenti/Sezione'
import { BadgeStato } from '../componenti/BadgeStato'
import { ErroreRegola, statiSceglibili } from '../lib/stati'
import { ETICHETTE_METODO, ETICHETTE_STATO, METODI, type Cliente, type MetodoPagamento, type Ordine, type Pagamento, type StatoOrdine } from '../lib/tipi'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

async function caricaLogo(): Promise<string | undefined> {
  try {
    // marchio quadrato: il PDF lo inserisce in un riquadro 30x30
    const blob = await (await fetch('/icon-512.png')).blob()
    return await new Promise((ok, ko) => {
      const r = new FileReader()
      r.onload = () => ok(r.result as string)
      r.onerror = ko
      r.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

function FormPagamento({ id, residuo }: { id: string; residuo: number }) {
  const [importo, setImporto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPagamento | ''>('')
  const [data, setData] = useState(oggiISO())
  const [errore, setErrore] = useState('')

  async function aggiungi(e: FormEvent) {
    e.preventDefault()
    const cent = parseEuro(importo)
    if (cent === null || cent <= 0) return setErrore('Scrivi un importo valido')
    if (cent > Math.max(0, residuo)) return setErrore(`L'importo supera quello che resta da pagare (${formatEuro(Math.max(0, residuo))}).`)
    setErrore('')
    try {
      await aggiungiPagamento(id, { importoCent: cent, data: data || oggiISO(), ...(metodo ? { metodo } : {}) })
      setImporto('')
    } catch (err) {
      setErrore(err instanceof ErroreRegola ? err.message : ERRORE_SCRITTURA)
    }
  }

  return (
    <form className="scheda" onSubmit={(e) => void aggiungi(e)} aria-label="Nuovo pagamento">
      <h2>Registra un pagamento</h2>
      <label htmlFor="pg-imp">Importo (€)</label>
      <input id="pg-imp" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} />
      <div className="griglia2">
        <div>
          <label htmlFor="pg-met">Metodo</label>
          <select id="pg-met" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagamento | '')}>
            <option value="">Non indicato</option>
            {METODI.map((m) => <option key={m} value={m}>{ETICHETTE_METODO[m]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pg-data">Data</label>
          <input id="pg-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      {errore && <p className="errore" role="alert">{errore}</p>}
      <p><button type="submit">Aggiungi pagamento</button></p>
    </form>
  )
}

export default function OrdineDettaglio() {
  const { id = '' } = useParams()
  const [ordine, setOrdine] = useState<Ordine | null | undefined>(undefined)
  const [erroreAzione, setErroreAzione] = useState('')
  const [copiato, setCopiato] = useState(false)
  const navigate = useNavigate()

  const [cliente, setCliente] = useState<Cliente | null>(null)

  const [tutti, setTutti] = useState<Ordine[]>([])

  useEffect(() => ascoltaOrdine(id, setOrdine), [id])
  useEffect(() => ascoltaOrdini(setTutti), [])
  const clienteId = ordine?.clienteId
  useEffect(() => (clienteId ? ascoltaCliente(clienteId, setCliente) : undefined), [clienteId])

  const cambioStato = useCambioStato(ordine)

  if (ordine === undefined) return <main className="pagina">Caricamento…</main>
  if (ordine === null) return <main className="pagina"><p>Ordine non trovato.</p><Link to="/ordini">Torna agli ordini</Link></main>

  // nome e telefono sono copiati nell'ordine alla creazione: se la scheda cliente cambia, vale la scheda
  const vivo: Ordine = {
    ...ordine,
    clienteNome: cliente?.nome || ordine.clienteNome,
    clienteTelefono: cliente?.telefono || ordine.clienteTelefono,
  }
  const link = linkWhatsApp(vivo)
  const residuo = residuoCent(ordine)

  // l'ordine prima e quello dopo (per numero), per scorrere senza tornare all'elenco
  const precedente = tutti.filter((o) => o.numero < ordine.numero).sort((a, b) => b.numero - a.numero)[0]
  const successivo = tutti.filter((o) => o.numero > ordine.numero).sort((a, b) => a.numero - b.numero)[0]
  const nelleSpedizioni =
    ordine.stato === 'spedito' ? '/spedizioni?vista=spediti'
    : ordine.stato === 'in attesa acconto' ? '/spedizioni?vista=attesa'
    : ordine.stato === 'consegnato' ? '/spedizioni?vista=consegnati'
    : '/spedizioni'
  const filtroCliente = `/ordini?cliente=${encodeURIComponent(ordine.clienteId)}`

  async function esegui(azione: () => Promise<void>) {
    setErroreAzione('')
    try {
      await azione()
    } catch (e) {
      setErroreAzione(e instanceof ErroreRegola ? e.message : ERRORE_SCRITTURA)
    }
  }

  async function copiaLink() {
    try {
      await navigator.clipboard.writeText(linkOrdine(ordine!.id))
      setCopiato(true)
    } catch {
      setCopiato(false)
      document.getElementById('link-ordine')?.focus()
      setErroreAzione('Non sono riuscito a copiare: seleziona il link qui sopra e copialo a mano.')
    }
  }

  function eliminaQuestoOrdine() {
    const versato = versatoCent(ordine!)
    const testo =
      versato > 0
        ? `Eliminare l'ordine n. ${ordine!.numero}? Ha pagamenti per ${formatEuro(versato)}: spariranno anche dagli incassi. Non si può annullare. Se il cliente ha rinunciato, di solito basta mettere lo stato "annullato".`
        : `Eliminare l'ordine n. ${ordine!.numero}? Non si può annullare.`
    if (!window.confirm(testo)) return
    void esegui(async () => {
      await eliminaOrdine(ordine!.id)
      navigate('/ordini')
    })
  }

  function togliPagamento(p: Pagamento) {
    if (window.confirm('Rimuovere questo pagamento? Sparirà anche dagli incassi.')) {
      void esegui(() => rimuoviPagamento(ordine!.id, p))
    }
  }

  async function scaricaPdf(o: Ordine) {
    setErroreAzione('')
    try {
      const blob = await generaPdfOrdine(o, await caricaLogo())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ordine-${o.numero}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setErroreAzione('Non sono riuscito a creare il PDF.')
    }
  }

  return (
    <main className="pagina">
      <div className="solo-stampa intestazione-stampa">
        <img src="/logo.png" alt="" />
        <strong>La Bottega di Tata e Gegè</strong>
      </div>
      <Briciole
        voci={[
          { testo: 'Ordini', a: '/ordini' },
          { testo: vivo.clienteNome, a: `/clienti/${ordine.clienteId}` },
          { testo: `n. ${ordine.numero}` },
        ]}
      />
      <h1>Ordine n. {ordine.numero}</h1>
      {(precedente || successivo) && (
        <nav className="riga no-stampa" aria-label="Altri ordini">
          {precedente ? <Link to={`/ordini/${precedente.id}`}>← n. {precedente.numero} · {precedente.clienteNome}</Link> : <span />}
          {successivo ? <Link to={`/ordini/${successivo.id}`}>n. {successivo.numero} · {successivo.clienteNome} →</Link> : <span />}
        </nav>
      )}
      <p className="solo-stampa">Stato: {ETICHETTE_STATO[ordine.stato]}</p>
      <p>
        <Link to={`/clienti/${ordine.clienteId}`}><strong>{ordine.clienteNome}</strong></Link>
        {ordine.clienteTelefono ? ` · ${ordine.clienteTelefono}` : ''} · {ordine.canale}
        {ordine.dataConsegna ? ` · consegna ${formatData(ordine.dataConsegna)}` : ''}
      </p>

      <p className="no-stampa">
        {cliente?.spedizione ? (
          <>Spedizione a: {testoIndirizzo(cliente.spedizione)}</>
        ) : (
          <>Nessun indirizzo di spedizione. <Link to={`/clienti/${ordine.clienteId}?apri=spedizione`}>Aggiungilo nella scheda cliente</Link></>
        )}
      </p>
      {ordine.notePreparazione && <p className="solo-stampa">Preparazione: {ordine.notePreparazione}</p>}

      <p className="no-stampa"><BadgeStato stato={ordine.stato} /></p>
      <div className="scorciatoie no-stampa" aria-label="Scorciatoie">
        <Link to={`/clienti/${ordine.clienteId}`}>Scheda cliente</Link>
        <Link to={filtroCliente}>Altri ordini di {vivo.clienteNome}</Link>
        <Link to={`/ordini/nuovo?cliente=${encodeURIComponent(ordine.clienteId)}`}>+ Nuovo ordine per {vivo.clienteNome}</Link>
        <Link to={nelleSpedizioni}>Nelle Spedizioni</Link>
      </div>
      <label htmlFor="stato" className="no-stampa">Stato dell&apos;ordine</label>
      <select id="stato" className="no-stampa" value={ordine.stato} onChange={(e) => {
        const nuovo = e.target.value as StatoOrdine
        void cambioStato.cambia(nuovo, nuovo === 'spedito' && !ordine.dataSpedizione ? { dataSpedizione: oggiISO() } : undefined)
      }}>
        {statiSceglibili(ordine).map((s) => <option key={s} value={s}>{ETICHETTE_STATO[s]}</option>)}
      </select>
      {cambioStato.errore && <p className="errore no-stampa" role="alert">{cambioStato.errore}</p>}
      <div className="no-stampa">
        <AvvisoMateriali avviso={cambioStato.avviso} onProcedi={() => void cambioStato.procediComunque()} onFerma={cambioStato.ferma} occupato={cambioStato.occupato} />
      </div>
      <section className="scheda no-stampa" style={{ marginTop: '1rem' }} aria-label="Avanzamento">
        <AvanzamentoOrdine key={ordine.id} ordine={vivo} indirizzo={cliente?.spedizione} />
      </section>

      <section className="scheda" style={{ marginTop: '1rem' }}>
        {ordine.righe.map((r, i) => (
          <div className="riga" key={i}>
            <span>{r.quantita} × {r.descrizione}{r.testoPersonalizzato ? ` (${r.testoPersonalizzato})` : ''}</span>
            <span>{formatEuro(r.quantita * r.prezzoUnitarioCent)}</span>
          </div>
        ))}
        {haSpedizione(ordine) && (
          <div className="riga">
            <span>Spedizione</span>
            <span>{spedizioneCent(ordine) > 0 ? formatEuro(spedizioneCent(ordine)) : 'gratuita'}</span>
          </div>
        )}
        <hr />
        <div className="riga"><span>Totale{spedizioneCent(ordine) > 0 ? ' (spedizione compresa)' : ''}</span><strong>{formatEuro(totaleOrdineCent(ordine))}</strong></div>
        <div className="riga"><span>Versato</span><strong>{formatEuro(versatoCent(ordine))}</strong></div>
        {ordine.stato !== 'annullato' && (
          <div className="riga">
            <span>{residuo < 0 ? 'Pagato in più' : 'Da saldare'}</span>
            <strong>{formatEuro(Math.abs(residuo))}</strong>
          </div>
        )}
        <p><BadgePagamento ordine={ordine} /></p>
        {ordine.note && <p>Note: {ordine.note}</p>}
      </section>

      <div className="azioni">
        {link ? (
          <a className="bottone" href={link} target="_blank" rel="noopener noreferrer">Invia su WhatsApp</a>
        ) : (
          <>
            <button type="button" disabled>Invia su WhatsApp</button>
            <small>Aggiungi il telefono del cliente</small>
          </>
        )}
        <Link to={`/ordini/${ordine.id}/modifica`} className="bottone secondario-link">Modifica ordine</Link>
        <button type="button" className="secondario" onClick={() => void scaricaPdf(vivo)}>Scarica PDF</button>
        <button type="button" className="secondario" onClick={() => window.print()}>Stampa</button>
      </div>
      {erroreAzione && <p className="errore" role="alert">{erroreAzione}</p>}

      <div className="no-stampa">
        <Sezione titolo="Link dell'ordine" ricorda="dettaglio:link">
          <label htmlFor="link-ordine">Si apre solo dopo il login</label>
          <input id="link-ordine" readOnly value={linkOrdine(ordine.id)} onFocus={(e) => e.currentTarget.select()} />
          <p>
            <button type="button" className="secondario" onClick={() => void copiaLink()}>Copia link</button>{' '}
            {copiato && <span role="status">Link copiato</span>}
          </p>
        </Sezione>
      </div>
      <p className="solo-stampa">Link: {linkOrdine(ordine.id)}</p>

      <Sezione titolo="Pagamenti" conteggio={ordine.pagamenti.length} aperta ricorda="dettaglio:pagamenti">
        {ordine.pagamenti.length === 0 && <p>Nessun pagamento registrato.</p>}
        {ordine.pagamenti.map((p, i) => (
          <div className="scheda riga" key={i}>
            <span>{formatData(p.data)} · {p.metodo ? ETICHETTE_METODO[p.metodo] : 'metodo non indicato'}</span>
            <span>
              <strong>{formatEuro(p.importoCent)}</strong>{' '}
              <button type="button" className="secondario" aria-label={`Rimuovi pagamento ${i + 1}`} onClick={() => togliPagamento(p)}>Rimuovi</button>
            </span>
          </div>
        ))}
        <FormPagamento id={ordine.id} residuo={residuo} />
      </Sezione>

      <div className="no-stampa">
        <Sezione titolo="Costo di spedizione" ricorda="dettaglio:costo-spedizione" aperta={!haSpedizione(ordine)}>
          <CostoSpedizione key={`${ordine.id}-${ordine.costoSpedizioneCent ?? 'x'}`} ordine={ordine} />
        </Sezione>
        <Sezione titolo="Altre azioni" ricorda="dettaglio:azioni">
          <p>
            <button type="button" className="pericolo" onClick={eliminaQuestoOrdine}>Elimina ordine</button>
          </p>
          <p className="nota">Se il cliente ha solo rinunciato, di solito conviene mettere lo stato «Annullato» invece di eliminare.</p>
        </Sezione>
      </div>
    </main>
  )
}
