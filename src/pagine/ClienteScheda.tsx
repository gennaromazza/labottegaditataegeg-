import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { aggiornaCliente, ascoltaCliente, eliminaCliente } from '../data/clienti'
import { ascoltaOrdini } from '../data/ordini'
import { OrdineCard } from '../componenti/OrdineCard'
import { formatEuro, residuoCent, versatoCent } from '../lib/calcoli'
import { caricaComuni, cercaPerCap, cercaPerNome, type Comune } from '../lib/comuni'
import type { Cliente, Ordine, Spedizione } from '../lib/tipi'

function FormSpedizione({ cliente }: { cliente: Cliente }) {
  const s = cliente.spedizione
  const [destinatario, setDestinatario] = useState(s?.destinatario ?? '')
  const [indirizzo, setIndirizzo] = useState(s?.indirizzo ?? '')
  const [cap, setCap] = useState(s?.cap ?? '')
  const [citta, setCitta] = useState(s?.citta ?? '')
  const [provincia, setProvincia] = useState(s?.provincia ?? '')
  const [errore, setErrore] = useState('')
  const [salvato, setSalvato] = useState(false)

  // elenco dei comuni, caricato solo quando serve
  const [comuni, setComuni] = useState<Comune[] | null>(null)
  const [scelteCap, setScelteCap] = useState<Comune[]>([]) // comuni che condividono il CAP digitato
  const [capDaApplicare, setCapDaApplicare] = useState<string | null>(null)
  const [capDelComune, setCapDelComune] = useState<string[]>([]) // CAP del comune scelto (città con più CAP)
  const [mostraCitta, setMostraCitta] = useState(false)

  useEffect(() => {
    let attivo = true
    caricaComuni().then((l) => attivo && setComuni(l)).catch(() => {})
    return () => {
      attivo = false
    }
  }, [])

  function applicaCap(c: string, lista: Comune[]) {
    const trovati = cercaPerCap(lista, c)
    if (trovati.length === 1) {
      setCitta(trovati[0][0])
      setProvincia(trovati[0][1])
      setScelteCap([])
      setCapDelComune(trovati[0][2])
    } else {
      setScelteCap(trovati)
    }
  }

  useEffect(() => {
    if (comuni && capDaApplicare) {
      applicaCap(capDaApplicare, comuni)
      setCapDaApplicare(null)
    }
  }, [comuni, capDaApplicare])

  function cambiaCap(valore: string) {
    const c = valore.replace(/\D/g, '').slice(0, 5)
    setCap(c)
    setScelteCap([])
    if (c.length === 5) {
      if (comuni) applicaCap(c, comuni)
      else setCapDaApplicare(c)
    } else {
      setCapDaApplicare(null)
    }
  }

  function scegliComune(c: Comune) {
    setCitta(c[0])
    setProvincia(c[1])
    setScelteCap([])
    setMostraCitta(false)
    setCapDelComune(c[2])
    if (c[2].length === 1) setCap(c[2][0])
    else if (!c[2].includes(cap)) setCap('')
  }

  const suggerimentiCitta = comuni && mostraCitta ? cercaPerNome(comuni, citta) : []

  async function salva(e: FormEvent) {
    e.preventDefault()
    setSalvato(false)
    if (!indirizzo.trim() || !citta.trim()) return setErrore('Indirizzo e città sono obbligatori')
    if (!/^\d{5}$/.test(cap.trim())) return setErrore('Il CAP deve avere 5 cifre')
    if (!/^[A-Za-z]{2}$/.test(provincia.trim())) return setErrore('La provincia deve avere 2 lettere (es. NA)')
    setErrore('')
    const spedizione: Spedizione = {
      ...(destinatario.trim() ? { destinatario: destinatario.trim() } : {}),
      indirizzo: indirizzo.trim(),
      cap: cap.trim(),
      citta: citta.trim(),
      provincia: provincia.trim().toUpperCase(),
    }
    try {
      await aggiornaCliente(cliente.id, { spedizione })
      setSalvato(true)
    } catch {
      setErrore('Non sono riuscito a salvare. Controlla la connessione e riprova.')
    }
  }

  return (
    <form className="scheda" onSubmit={(e) => void salva(e)} aria-label="Dati di spedizione">
      <h2>Dati di spedizione</h2>
      <label htmlFor="sp-dest">Destinatario (se diverso dal cliente)</label>
      <input id="sp-dest" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
      <label htmlFor="sp-ind">Indirizzo</label>
      <input id="sp-ind" value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
      <div className="griglia2">
        <div>
          <label htmlFor="sp-cap">CAP</label>
          <input id="sp-cap" inputMode="numeric" maxLength={5} list="cap-suggeriti" value={cap} onChange={(e) => cambiaCap(e.target.value)} />
          <datalist id="cap-suggeriti">
            {capDelComune.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label htmlFor="sp-prov">Provincia</label>
          <input id="sp-prov" maxLength={2} value={provincia} onChange={(e) => setProvincia(e.target.value)} />
        </div>
      </div>
      {scelteCap.length > 1 && (
        <div role="group" aria-label="Comuni con questo CAP">
          <p>Questo CAP è di più comuni, scegli:</p>
          {scelteCap.map((c) => (
            <button key={`${c[0]}-${c[1]}`} type="button" className="secondario" style={{ margin: '0 .4rem .4rem 0' }} onClick={() => scegliComune(c)}>
              {c[0]} ({c[1]})
            </button>
          ))}
        </div>
      )}
      <label htmlFor="sp-citta">Città</label>
      <input
        id="sp-citta"
        autoComplete="off"
        value={citta}
        onChange={(e) => {
          setCitta(e.target.value)
          setMostraCitta(true)
        }}
      />
      {suggerimentiCitta.length > 0 && (
        <div role="listbox" aria-label="Comuni suggeriti">
          {suggerimentiCitta.map((c) => (
            <button key={`${c[0]}-${c[1]}`} type="button" role="option" aria-selected="false" className="secondario" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: '.3rem' }} onClick={() => scegliComune(c)}>
              {c[0]} ({c[1]}){c[2].length === 1 ? ` · ${c[2][0]}` : ` · ${c[2].length} CAP`}
            </button>
          ))}
        </div>
      )}
      {errore && <p className="errore" role="alert">{errore}</p>}
      {salvato && <p role="status">Dati di spedizione salvati</p>}
      <p><button type="submit">Salva spedizione</button></p>
    </form>
  )
}

function FormAnagrafica({ cliente }: { cliente: Cliente }) {
  const [nome, setNome] = useState(cliente.nome)
  const [telefono, setTelefono] = useState(cliente.telefono ?? '')
  const [note, setNote] = useState(cliente.note ?? '')
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    try {
      await aggiornaCliente(cliente.id, { nome: nome.trim(), telefono: telefono.trim(), note: note.trim() })
      setSalvato(true)
    } catch {
      setErrore('Non sono riuscito a salvare. Controlla la connessione e riprova.')
    }
  }

  return (
    <form className="scheda" onSubmit={(e) => void salva(e)} aria-label="Anagrafica">
      <h2>Anagrafica</h2>
      <label htmlFor="an-nome">Nome</label>
      <input id="an-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <label htmlFor="an-tel">Telefono</label>
      <input id="an-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      <label htmlFor="an-note">Note</label>
      <textarea id="an-note" value={note} onChange={(e) => setNote(e.target.value)} />
      {errore && <p className="errore" role="alert">{errore}</p>}
      {salvato && <p role="status">Anagrafica salvata</p>}
      <p><button type="submit">Salva anagrafica</button></p>
    </form>
  )
}

export default function ClienteScheda() {
  const { id = '' } = useParams()
  const [cliente, setCliente] = useState<Cliente | null | undefined>(undefined)
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [erroreElimina, setErroreElimina] = useState('')
  const navigate = useNavigate()

  useEffect(() => ascoltaCliente(id, setCliente), [id])
  useEffect(() => ascoltaOrdini(setOrdini), [])

  if (cliente === undefined) return <main className="pagina">Caricamento…</main>
  if (cliente === null) return <main className="pagina"><p>Cliente non trovato.</p><Link to="/clienti">Torna ai clienti</Link></main>

  const suoi = ordini.filter((o) => o.clienteId === cliente.id)
  const incassato = suoi.reduce((s, o) => s + versatoCent(o), 0)
  const daIncassare = suoi.filter((o) => o.stato !== 'annullato').reduce((s, o) => s + Math.max(0, residuoCent(o)), 0)
  const aperti = suoi.filter((o) => o.stato !== 'consegnato' && o.stato !== 'annullato').length

  async function eliminaQuestoCliente() {
    const testo =
      suoi.length > 0
        ? `Eliminare ${cliente!.nome}? Ha ordini collegati (${suoi.length}): restano nell'elenco ordini con il nome e il telefono già copiati, ma la scheda cliente sparisce. Non si può annullare.`
        : `Eliminare ${cliente!.nome}? Non si può annullare.`
    if (!window.confirm(testo)) return
    setErroreElimina('')
    try {
      await eliminaCliente(cliente!.id)
      navigate('/clienti')
    } catch {
      setErroreElimina('Non sono riuscito a eliminare. Controlla la connessione e riprova.')
    }
  }

  return (
    <main className="pagina">
      <p><Link to="/clienti">← Clienti</Link></p>
      <h1>{cliente.nome}</h1>
      <p>{cliente.telefono ?? 'Nessun telefono'}</p>

      <section aria-label="Ordini del cliente">
        <div className="riga">
          <h2>Ordini ({suoi.length})</h2>
          <Link to={`/ordini/nuovo?cliente=${encodeURIComponent(cliente.id)}`} className="bottone">+ Nuovo ordine</Link>
        </div>
        {suoi.length > 0 && (
          <p>
            Aperti: <strong>{aperti}</strong> · Incassato: <strong>{formatEuro(incassato)}</strong> · Da incassare: <strong>{formatEuro(daIncassare)}</strong>
          </p>
        )}
        {suoi.length === 0 && <p>Nessun ordine per questo cliente.</p>}
        {suoi.map((o) => <OrdineCard key={o.id} ordine={o} mostraCliente={false} />)}
      </section>

      <FormAnagrafica key={`a-${cliente.id}`} cliente={cliente} />
      <FormSpedizione key={`s-${cliente.id}`} cliente={cliente} />

      {erroreElimina && <p className="errore" role="alert">{erroreElimina}</p>}
      <p className="no-stampa">
        <button type="button" className="pericolo" onClick={() => void eliminaQuestoCliente()}>Elimina cliente</button>
      </p>
    </main>
  )
}
