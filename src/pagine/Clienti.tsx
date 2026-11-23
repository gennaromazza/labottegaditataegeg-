import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ascoltaClienti } from '../data/clienti'
import { SelezionaCliente } from '../componenti/SelezionaCliente'
import type { Cliente } from '../lib/tipi'

export default function Clienti() {
  const navigate = useNavigate()
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [ricerca, setRicerca] = useState('')
  const [aggiungi, setAggiungi] = useState(false)

  useEffect(() => ascoltaClienti(setClienti), [])

  const q = ricerca.trim().toLowerCase()
  const visibili = clienti.filter((c) => !q || c.nome.toLowerCase().includes(q) || (c.telefono ?? '').includes(q))

  return (
    <main className="pagina">
      <h1>Clienti</h1>
      <label htmlFor="filtro-clienti">Cerca</label>
      <input id="filtro-clienti" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
      <p><button type="button" onClick={() => setAggiungi(!aggiungi)}>{aggiungi ? 'Chiudi' : '+ Nuovo cliente'}</button></p>
      {aggiungi && <div className="scheda"><SelezionaCliente onScelto={(c) => navigate(`/clienti/${c.id}`)} /></div>}
      {visibili.map((c) => (
        <Link key={c.id} to={`/clienti/${c.id}`} className="scheda link-scheda">
          <strong>{c.nome}</strong>
          <div>{c.telefono ?? 'Nessun telefono'}</div>
        </Link>
      ))}
      {visibili.length === 0 && <p>Nessun cliente trovato.</p>}
    </main>
  )
}
