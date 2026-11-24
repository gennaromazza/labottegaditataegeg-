import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ascoltaCliente } from '../data/clienti'
import { Briciole } from '../componenti/Briciole'
import { AvvisoMateriali, type Avviso } from '../componenti/CambioStato'
import { SelezionaCliente } from '../componenti/SelezionaCliente'
import { RigheEditor, righeDaForm, rigaVuota, type RigaForm } from '../componenti/RigheEditor'
import { creaOrdine, modificaOrdine } from '../data/ordini'
import { ascoltaArticoli } from '../data/magazzino'
import { oggiISO } from '../data/util'
import { formatEuro, haSpedizione, spedizioneCent as spedizioneDi, totaleCent } from '../lib/calcoli'
import { centInEuroTesto, parseEuro } from '../lib/importi'
import { ErroreMateriali } from '../lib/ricette'
import { ErroreRegola, statoIniziale } from '../lib/stati'
import { CANALI, ETICHETTE_METODO, METODI, type Articolo, type Canale, type Cliente, type MetodoPagamento, type Ordine, type Pagamento } from '../lib/tipi'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

/** Le righe dell'ordine, nel formato del modulo (testi). */
const righeInModulo = (o: Ordine): RigaForm[] =>
  o.righe.map((r) => ({
    ...(r.articoloId ? { articoloId: r.articoloId } : {}),
    descrizione: r.descrizione,
    testo: r.testoPersonalizzato ?? '',
    quantita: String(r.quantita),
    prezzo: centInEuroTesto(r.prezzoUnitarioCent),
  }))

/**
 * Il modulo dell'ordine: senza `iniziale` crea un ordine nuovo, con `iniziale` modifica quello esistente
 * (i pagamenti, lo stato e il numero restano com'erano: si gestiscono nella pagina dell'ordine).
 */
export default function OrdineForm({ iniziale }: { iniziale?: Ordine }) {
  const navigate = useNavigate()
  const modifica = iniziale !== undefined
  const [cliente, setCliente] = useState<Cliente | null>(
    iniziale ? { id: iniziale.clienteId, nome: iniziale.clienteNome, ...(iniziale.clienteTelefono ? { telefono: iniziale.clienteTelefono } : {}) } : null,
  )
  const [canale, setCanale] = useState<Canale>(iniziale?.canale ?? 'WhatsApp')
  const [righe, setRighe] = useState<RigaForm[]>(iniziale ? righeInModulo(iniziale) : [rigaVuota()])
  const [listino, setListino] = useState<Articolo[]>([])
  const [acconto, setAcconto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPagamento | ''>('')
  const [consegna, setConsegna] = useState(iniziale?.dataConsegna ?? '')
  const [spedizione, setSpedizione] = useState(iniziale && haSpedizione(iniziale) ? centInEuroTesto(spedizioneDi(iniziale)) : '')
  const [note, setNote] = useState(iniziale?.note ?? '')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const [avviso, setAvviso] = useState<Avviso | null>(null)

  useEffect(() => ascoltaArticoli(setListino), [])

  // /ordini/nuovo?cliente=<id>: parte dalla scheda cliente con il cliente già scelto
  const [params] = useSearchParams()
  const clienteDaLink = modifica ? null : params.get('cliente')
  useEffect(() => {
    if (!clienteDaLink) return undefined
    return ascoltaCliente(clienteDaLink, (c) => {
      if (c) setCliente((attuale) => attuale ?? c)
    })
  }, [clienteDaLink])

  const valide = righeDaForm(righe)
  // vuoto = nessuna riga di spedizione (ritiro a mano); 0 = "spedizione gratuita"
  const spedizioneCent = spedizione.trim() ? parseEuro(spedizione) : undefined
  const totale = (valide ? totaleCent(valide) : 0) + (spedizioneCent ?? 0)

  async function salva(e: FormEvent | null, procediComunque = false) {
    e?.preventDefault()
    if (!cliente) return setErrore('Scegli o crea il cliente')
    if (spedizione.trim() && spedizioneCent === null) return setErrore('Il costo di spedizione non è valido (scrivi per esempio 5,90, oppure 0 se è gratuita)')
    if (!valide || valide.length === 0) return setErrore('Aggiungi almeno un prodotto con nome, quantità e prezzo validi')
    let pagamenti: Pagamento[] = []
    if (!modifica && acconto.trim()) {
      const importo = parseEuro(acconto)
      if (importo === null) return setErrore('Acconto non valido')
      if (importo > totale) return setErrore(`L'acconto non può superare il totale dell'ordine (${formatEuro(totale)}).`)
      if (importo > 0) pagamenti = [{ importoCent: importo, data: oggiISO(), ...(metodo ? { metodo } : {}) }]
    }
    setErrore('')
    setInvio(true)
    const costo = spedizioneCent !== undefined && spedizioneCent !== null ? spedizioneCent : undefined
    try {
      if (iniziale) {
        await modificaOrdine(
          iniziale.id,
          {
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            ...(cliente.telefono ? { clienteTelefono: cliente.telefono } : {}),
            canale,
            righe: valide,
            ...(consegna ? { dataConsegna: consegna } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(costo !== undefined ? { costoSpedizioneCent: costo } : {}),
          },
          { procediComunque },
        )
        navigate(`/ordini/${iniziale.id}`)
        return
      }
      const o = await creaOrdine({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        ...(cliente.telefono ? { clienteTelefono: cliente.telefono } : {}),
        canale,
        righe: valide,
        stato: statoIniziale(pagamenti.reduce((s, p) => s + p.importoCent, 0)),
        ...(consegna ? { dataConsegna: consegna } : {}),
        ...(costo !== undefined ? { costoSpedizioneCent: costo } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        pagamenti,
      })
      navigate(`/ordini/${o.id}`)
    } catch (err) {
      if (err instanceof ErroreMateriali && iniziale) setAvviso({ nuovo: iniziale.stato, mancanti: err.mancanti, problemi: [] })
      else setErrore(err instanceof ErroreRegola ? err.message : ERRORE_SCRITTURA)
      setInvio(false)
    }
  }

  const materialiScalati = modifica && iniziale.scaricoMagazzino !== undefined
  const partito = modifica && (iniziale.stato === 'spedito' || iniziale.stato === 'consegnato')

  return (
    <main className="pagina">
      <Briciole
        voci={
          iniziale
            ? [{ testo: 'Ordini', a: '/ordini' }, { testo: `n. ${iniziale.numero}`, a: `/ordini/${iniziale.id}` }, { testo: 'Modifica' }]
            : [{ testo: 'Ordini', a: '/ordini' }, { testo: 'Nuovo ordine' }]
        }
      />
      <h1>{iniziale ? `Modifica ordine n. ${iniziale.numero}` : 'Nuovo ordine'}</h1>
      {materialiScalati && !partito && (
        <p className="nota" role="status">I materiali sono già stati scalati dal magazzino: se cambi prodotti o quantità, il magazzino si aggiorna con la differenza.</p>
      )}
      {partito && (
        <p className="nota" role="status">Questo ordine è già partito: puoi correggere i dati, ma il magazzino non viene ricalcolato.</p>
      )}
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
        <section className="scheda">
          <label htmlFor="spedizione">Costo di spedizione per il cliente (€, facoltativo)</label>
          <input id="spedizione" inputMode="decimal" value={spedizione} onChange={(e) => setSpedizione(e.target.value)} />
          <p className="nota">Si somma al totale e compare nel messaggio WhatsApp. Lascia vuoto se non c&apos;è spedizione (ritiro a mano); scrivi 0 per «spedizione gratuita».</p>
        </section>
        <p>
          Totale{spedizioneCent ? ' (spedizione compresa)' : ''}: <strong data-testid="totale">{formatEuro(totale)}</strong>
        </p>

        <section className="scheda">
          {modifica ? (
            <p className="nota">I pagamenti si registrano e si tolgono nella pagina dell&apos;ordine: qui non cambiano.</p>
          ) : (
            <>
              <label htmlFor="acconto">Acconto ricevuto (€, facoltativo)</label>
              <input id="acconto" inputMode="decimal" value={acconto} onChange={(e) => setAcconto(e.target.value)} />
              <p className="nota">Con un acconto l&apos;ordine parte confermato. Senza, resta &quot;in attesa di acconto&quot; e non si procede finché non arriva.</p>
              <label htmlFor="metodo">Metodo dell&apos;acconto</label>
              <select id="metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagamento | '')}>
                <option value="">Non indicato</option>
                {METODI.map((m) => <option key={m} value={m}>{ETICHETTE_METODO[m]}</option>)}
              </select>
            </>
          )}
          <label htmlFor="consegna">Data di consegna</label>
          <input id="consegna" type="date" value={consegna} onChange={(e) => setConsegna(e.target.value)} />
          <label htmlFor="note">Note</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </section>

        <AvvisoMateriali
          avviso={avviso}
          occupato={invio}
          onProcedi={() => {
            setAvviso(null)
            void salva(null, true)
          }}
          onFerma={() => setAvviso(null)}
        />
        {errore && <p className="errore" role="alert">{errore}</p>}
        <div className="azioni">
          <button type="submit" disabled={invio}>{modifica ? 'Salva modifiche' : 'Salva ordine'}</button>
          {iniziale && <Link to={`/ordini/${iniziale.id}`} className="bottone secondario-link">Annulla</Link>}
        </div>
      </form>
    </main>
  )
}
