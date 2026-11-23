import { Link } from 'react-router-dom'
import { BadgePagamento } from './BadgePagamento'
import { formatData, formatEuro, residuoCent, totaleCent } from '../lib/calcoli'
import type { Ordine } from '../lib/tipi'

export function OrdineCard({ ordine: o, mostraCliente = true }: { ordine: Ordine; mostraCliente?: boolean }) {
  return (
    <Link to={`/ordini/${o.id}`} className="scheda link-scheda">
      <div className="riga">
        <strong>n. {o.numero}{mostraCliente ? ` · ${o.clienteNome}` : ''}</strong>
        <span className="badge">{o.stato}</span>
      </div>
      <div className="riga">
        <span>{o.canale}{o.dataConsegna ? ` · consegna ${formatData(o.dataConsegna)}` : ''}</span>
        <BadgePagamento ordine={o} />
      </div>
      <div className="riga">
        <span>Totale {formatEuro(totaleCent(o.righe))}</span>
        <strong>{o.stato !== 'annullato' && residuoCent(o) > 0 ? `Da incassare ${formatEuro(residuoCent(o))}` : ''}</strong>
      </div>
    </Link>
  )
}
