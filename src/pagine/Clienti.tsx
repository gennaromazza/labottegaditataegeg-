import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MostraAltri, usePaginazione } from '../componenti/Paginazione'
import { SelezionaCliente } from '../componenti/SelezionaCliente'
import { ascoltaClienti } from '../data/clienti'
import { ascoltaOrdini } from '../data/ordini'
import { formatEuro, residuoCent } from '../lib/calcoli'
import { normalizza } from '../lib/testo'
import type { Cliente, Ordine } from '../lib/tipi'

export default function Clienti() {
  const navigate = useNavigate()
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [ricerca, setRicerca] = useState('')
  const [aggiungi, setAggiungi] = useState(false)

  useEffect(() => ascoltaClienti(setClienti), [])
  useEffect(() => ascoltaOrdini(setOrdini), [])

  const q = normalizza(ricerca)
  const cifre = ricerca.replace(/\D/g, '')
  const visibili = clienti.filter(
    (c) => !q || normalizza(c.nome).includes(q) || (cifre.length >= 3 && (c.telefono ?? '').replace(/\D/g, '').includes(cifre)),
  )
  const { visibili: pagina, resto, mostraAltri } = usePaginazione(visibili, 15, ricerca)

  // per ogni cliente: quanti ordini ha e quanto resta da incassare (per capire a colpo d'occhio chi guardare)
  const riepilogo = new Map<string, { ordini: number; daIncassare: number }>()
  for (const o of ordini) {
    const r = riepilogo.get(o.clienteId) ?? { ordini: 0, daIncassare: 0 }
    r.ordini += 1
    if (o.stato !== 'annullato') r.daIncassare += Math.max(0, residuoCent(o))
    riepilogo.set(o.clienteId, r)
  }

  return (
    <main className="pagina">
      <div className="riga">
        <h1>Clienti</h1>
        <button type="button" onClick={() => setAggiungi(!aggiungi)}>{aggiungi ? 'Chiudi' : '+ Nuovo cliente'}</button>
      </div>
      {aggiungi && <div className="scheda"><SelezionaCliente onScelto={(c) => navigate(`/clienti/${c.id}`)} /></div>}

      <label htmlFor="filtro-clienti">Cerca</label>
      <input id="filtro-clienti" autoComplete="off" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
      <p className="nota" aria-live="polite">
        {visibili.length === 1 ? '1 cliente' : `${visibili.length} clienti`}{visibili.length !== clienti.length ? ` su ${clienti.length}` : ''}
      </p>

      {pagina.map((c) => {
        const r = riepilogo.get(c.id)
        return (
          <Link key={c.id} to={`/clienti/${c.id}`} className="scheda link-scheda">
            <strong>{c.nome}</strong>
            <div>{c.telefono ?? 'Nessun telefono'}</div>
            {r && (
              <div className="nota">
                {r.ordini === 1 ? '1 ordine' : `${r.ordini} ordini`}
                {r.daIncassare > 0 ? ` · da incassare ${formatEuro(r.daIncassare)}` : ''}
              </div>
            )}
          </Link>
        )
      })}
      {visibili.length === 0 && <p>Nessun cliente trovato.</p>}
      <MostraAltri resto={resto} onClick={mostraAltri} />
    </main>
  )
}
