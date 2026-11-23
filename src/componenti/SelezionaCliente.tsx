import { useEffect, useState } from 'react'
import { ascoltaClienti, creaCliente } from '../data/clienti'
import type { Cliente } from '../lib/tipi'

interface Props {
  onScelto: (c: Cliente) => void
}

export function SelezionaCliente({ onScelto }: Props) {
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [ricerca, setRicerca] = useState('')
  const [nuovo, setNuovo] = useState(false)
  const [nome, setNome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [errore, setErrore] = useState('')

  useEffect(() => ascoltaClienti(setClienti), [])

  const q = ricerca.trim().toLowerCase()
  const trovati = q
    ? clienti.filter((c) => c.nome.toLowerCase().includes(q) || (c.telefono ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    : []

  async function crea() {
    if (!nome.trim()) {
      setErrore('Scrivi il nome del cliente')
      return
    }
    setErrore('')
    const c = await creaCliente({ nome: nome.trim(), ...(telefono.trim() ? { telefono: telefono.trim() } : {}) })
    onScelto(c)
  }

  return (
    <div>
      <label htmlFor="cerca-cliente">Cerca cliente (nome o telefono)</label>
      <input id="cerca-cliente" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
      {trovati.map((c) => (
        <button key={c.id} type="button" className="secondario" style={{ display: 'block', width: '100%', marginTop: '.4rem', textAlign: 'left' }} onClick={() => onScelto(c)}>
          {c.nome}{c.telefono ? ` · ${c.telefono}` : ''}
        </button>
      ))}
      {!nuovo ? (
        <p><button type="button" className="secondario" onClick={() => { setNuovo(true); setNome(ricerca) }}>+ Nuovo cliente</button></p>
      ) : (
        <div className="scheda">
          <label htmlFor="nuovo-nome">Nome del nuovo cliente</label>
          <input id="nuovo-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <label htmlFor="nuovo-tel">Telefono (facoltativo)</label>
          <input id="nuovo-tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          {errore && <p className="errore" role="alert">{errore}</p>}
          <p><button type="button" onClick={() => void crea()}>Crea cliente</button></p>
        </div>
      )}
    </div>
  )
}
