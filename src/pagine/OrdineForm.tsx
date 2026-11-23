import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ascoltaCliente } from '../data/clienti'
import { SelezionaCliente } from '../componenti/SelezionaCliente'
import { RigheEditor, righeDaForm, rigaVuota, type RigaForm } from '../componenti/RigheEditor'
import { creaOrdine } from '../data/ordini'
import { ascoltaArticoli } from '../data/magazzino'
import { oggiISO } from '../data/util'
import { formatEuro, totaleCent } from '../lib/calcoli'
import { parseEuro } from '../lib/importi'
import { statoIniziale } from '../lib/stati'
import { CANALI, ETICHETTE_METODO, METODI, type Articolo, type Canale, type Cliente, type MetodoPagamento, type Pagamento } from '../lib/tipi'

export default function OrdineForm() {
  const navigate = useNavigate()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [canale, setCanale] = useState<Canale>('WhatsApp')
  const [righe, setRighe] = useState<RigaForm[]>([rigaVuota()])
  const [listino, setListino] = useState<Articolo[]>([])
  const [acconto, setAcconto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPagamento | ''>('')
  const [consegna, setConsegna] = useState('')
  const [note, setNote] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  useEffect(() => ascoltaArticoli(setListino), [])

  // /ordini/nuovo?cliente=<id>: parte dalla scheda cliente con il cliente già scelto
  const [params] = useSearchParams()
  const clienteDaLink = params.get('cliente')
  useEffect(() => {
    if (!clienteDaLink) return undefined
    return ascoltaCliente(clienteDaLink, (c) => {
      if (c) setCliente((attuale) => attuale ?? c)
    })
  }, [clienteDaLink])

  const valide = righeDaForm(righe)
  const totale = valide ? totaleCent(valide) : 0

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!cliente) return setErrore('Scegli o crea il cliente')
    if (!valide || valide.length === 0) return setErrore('Aggiungi almeno un prodotto con nome, quantità e prezzo validi')
    let pagamenti: Pagamento[] = []
    if (acconto.trim()) {
      const importo = parseEuro(acconto)
      if (importo === null) return setErrore('Acconto non valido')
      if (importo > 0) pagamenti = [{ importoCent: importo, data: oggiISO(), ...(metodo ? { metodo } : {}) }]
    }
    setErrore('')
    setInvio(true)
    try {
      const o = await creaOrdine({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        ...(cliente.telefono ? { clienteTelefono: cliente.telefono } : {}),
        canale,
        righe: valide,
        stato: statoIniziale(pagamenti.reduce((s, p) => s + p.importoCent, 0)),
        ...(consegna ? { dataConsegna: consegna } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        pagamenti,
      })
      navigate(`/ordini/${o.id}`)
    } catch {
      setErrore('Non sono riuscito a salvare. Controlla la connessione e riprova.')
      setInvio(false)
    }
  }

  return (
    <main className="pagina">
      <p><Link to="/ordini">← Ordini</Link></p>
      <h1>Nuovo ordine</h1>
      <form onSubmit={(e) => void salva(e)}>
        <section className="scheda">
          <h2>Cliente</h2>
          {cliente ? (
            <div className="riga">
              <strong>{cliente.nome}{cliente.telefono ? ` · ${cliente.telefono}` : ''}</strong>
              <button type="button" className="secondario" onClick={() => setCliente(null)}>Cambia</button>
            </div>
          ) : (
            <SelezionaCliente onScelto={setCliente} />
          )}
          <label htmlFor="canale">Canale</label>
          <select id="canale" value={canale} onChange={(e) => setCanale(e.target.value as Canale)}>
            {CANALI.map((c) => <option key={c}>{c}</option>)}
          </select>
        </section>

        <h2>Prodotti</h2>
        <RigheEditor righe={righe} onChange={setRighe} listino={listino} />
        <p>Totale: <strong data-testid="totale">{formatEuro(totale)}</strong></p>

        <section className="scheda">
          <label htmlFor="acconto">Acconto ricevuto (€, facoltativo)</label>
          <input id="acconto" inputMode="decimal" value={acconto} onChange={(e) => setAcconto(e.target.value)} />
          <p className="nota">Con un acconto l&apos;ordine parte confermato. Senza, resta &quot;in attesa di acconto&quot; e non si procede finché non arriva.</p>
          <label htmlFor="metodo">Metodo dell&apos;acconto</label>
          <select id="metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagamento | '')}>
            <option value="">Non indicato</option>
            {METODI.map((m) => <option key={m} value={m}>{ETICHETTE_METODO[m]}</option>)}
          </select>
          <label htmlFor="consegna">Data di consegna</label>
          <input id="consegna" type="date" value={consegna} onChange={(e) => setConsegna(e.target.value)} />
          <label htmlFor="note">Note</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </section>

        {errore && <p className="errore" role="alert">{errore}</p>}
        <p><button type="submit" disabled={invio}>Salva ordine</button></p>
      </form>
    </main>
  )
}
