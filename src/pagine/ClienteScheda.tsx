import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { aggiornaCliente, ascoltaCliente } from '../data/clienti'
import { ascoltaOrdini } from '../data/ordini'
import { formatEuro, versatoCent } from '../lib/calcoli'
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
          <input id="sp-cap" inputMode="numeric" maxLength={5} value={cap} onChange={(e) => setCap(e.target.value)} />
        </div>
        <div>
          <label htmlFor="sp-prov">Provincia</label>
          <input id="sp-prov" maxLength={2} value={provincia} onChange={(e) => setProvincia(e.target.value)} />
        </div>
      </div>
      <label htmlFor="sp-citta">Città</label>
      <input id="sp-citta" value={citta} onChange={(e) => setCitta(e.target.value)} />
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

  useEffect(() => ascoltaCliente(id, setCliente), [id])
  useEffect(() => ascoltaOrdini(setOrdini), [])

  if (cliente === undefined) return <main className="pagina">Caricamento…</main>
  if (cliente === null) return <main className="pagina"><p>Cliente non trovato.</p><Link to="/clienti">Torna ai clienti</Link></main>

  const suoi = ordini.filter((o) => o.clienteId === cliente.id)
  const speso = suoi.reduce((s, o) => s + versatoCent(o), 0)

  return (
    <main className="pagina">
      <p><Link to="/clienti">← Clienti</Link></p>
      <h1>{cliente.nome}</h1>
      <p>Totale incassato da questo cliente: <strong>{formatEuro(speso)}</strong> in {suoi.length} ordini</p>
      <FormAnagrafica key={`a-${cliente.id}`} cliente={cliente} />
      <FormSpedizione key={`s-${cliente.id}`} cliente={cliente} />
      <h2>Ordini</h2>
      {suoi.length === 0 && <p>Nessun ordine.</p>}
      {suoi.map((o) => (
        <Link key={o.id} to={`/ordini/${o.id}`} className="scheda link-scheda">
          <div className="riga"><strong>Ordine n. {o.numero}</strong><span className="badge">{o.stato}</span></div>
        </Link>
      ))}
    </main>
  )
}
