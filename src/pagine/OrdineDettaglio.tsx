import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgePagamento } from '../componenti/BadgePagamento'
import { ascoltaCliente } from '../data/clienti'
import { aggiornaOrdine, aggiungiPagamento, ascoltaOrdine, rimuoviPagamento } from '../data/ordini'
import { oggiISO } from '../data/util'
import { formatData, formatEuro, residuoCent, totaleCent, versatoCent } from '../lib/calcoli'
import { parseEuro } from '../lib/importi'
import { linkOrdine } from '../lib/link'
import { generaPdfOrdine } from '../lib/pdf'
import { linkWhatsApp } from '../lib/whatsapp'
import { METODI, STATI, type Cliente, type MetodoPagamento, type Ordine, type Pagamento, type StatoOrdine } from '../lib/tipi'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

async function caricaLogo(): Promise<string | undefined> {
  try {
    const blob = await (await fetch('/logo.png')).blob()
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

function FormPagamento({ id }: { id: string }) {
  const [importo, setImporto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPagamento | ''>('')
  const [data, setData] = useState(oggiISO())
  const [errore, setErrore] = useState('')

  async function aggiungi(e: FormEvent) {
    e.preventDefault()
    const cent = parseEuro(importo)
    if (cent === null || cent <= 0) return setErrore('Scrivi un importo valido')
    setErrore('')
    try {
      await aggiungiPagamento(id, { importoCent: cent, data: data || oggiISO(), ...(metodo ? { metodo } : {}) })
      setImporto('')
    } catch {
      setErrore(ERRORE_SCRITTURA)
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
            {METODI.map((m) => <option key={m}>{m}</option>)}
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

  const [cliente, setCliente] = useState<Cliente | null>(null)

  useEffect(() => ascoltaOrdine(id, setOrdine), [id])
  const clienteId = ordine?.clienteId
  useEffect(() => (clienteId ? ascoltaCliente(clienteId, setCliente) : undefined), [clienteId])

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

  async function esegui(azione: () => Promise<void>) {
    setErroreAzione('')
    try {
      await azione()
    } catch {
      setErroreAzione(ERRORE_SCRITTURA)
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
      <p className="no-stampa"><Link to="/ordini">← Ordini</Link></p>
      <h1>Ordine n. {ordine.numero}</h1>
      <p className="solo-stampa">Stato: {ordine.stato}</p>
      <p>
        <Link to={`/clienti/${ordine.clienteId}`}><strong>{ordine.clienteNome}</strong></Link>
        {ordine.clienteTelefono ? ` · ${ordine.clienteTelefono}` : ''} · {ordine.canale}
        {ordine.dataConsegna ? ` · consegna ${formatData(ordine.dataConsegna)}` : ''}
      </p>

      <label htmlFor="stato">Stato dell&apos;ordine</label>
      <select id="stato" value={ordine.stato} onChange={(e) => void esegui(() => aggiornaOrdine(ordine.id, { stato: e.target.value as StatoOrdine }))}>
        {STATI.map((s) => <option key={s}>{s}</option>)}
      </select>

      <section className="scheda" style={{ marginTop: '1rem' }}>
        {ordine.righe.map((r, i) => (
          <div className="riga" key={i}>
            <span>{r.quantita} × {r.descrizione}{r.testoPersonalizzato ? ` (${r.testoPersonalizzato})` : ''}</span>
            <span>{formatEuro(r.quantita * r.prezzoUnitarioCent)}</span>
          </div>
        ))}
        <hr />
        <div className="riga"><span>Totale</span><strong>{formatEuro(totaleCent(ordine.righe))}</strong></div>
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
        <button type="button" className="secondario" onClick={() => void scaricaPdf(vivo)}>Scarica PDF</button>
        <button type="button" className="secondario" onClick={() => window.print()}>Stampa</button>
      </div>
      {erroreAzione && <p className="errore" role="alert">{erroreAzione}</p>}

      <section className="scheda no-stampa">
        <label htmlFor="link-ordine">Link dell&apos;ordine (si apre solo dopo il login)</label>
        <input id="link-ordine" readOnly value={linkOrdine(ordine.id)} onFocus={(e) => e.currentTarget.select()} />
        <p>
          <button type="button" className="secondario" onClick={() => void copiaLink()}>Copia link</button>{' '}
          {copiato && <span role="status">Link copiato</span>}
        </p>
      </section>
      <p className="solo-stampa">Link: {linkOrdine(ordine.id)}</p>

      <h2>Pagamenti</h2>
      {ordine.pagamenti.length === 0 && <p>Nessun pagamento registrato.</p>}
      {ordine.pagamenti.map((p, i) => (
        <div className="scheda riga" key={i}>
          <span>{formatData(p.data)} · {p.metodo ?? 'metodo non indicato'}</span>
          <span>
            <strong>{formatEuro(p.importoCent)}</strong>{' '}
            <button type="button" className="secondario" aria-label={`Rimuovi pagamento ${i + 1}`} onClick={() => togliPagamento(p)}>Rimuovi</button>
          </span>
        </div>
      ))}
      <FormPagamento id={ordine.id} />
    </main>
  )
}
