import { Link } from 'react-router-dom'

export interface Voce {
  testo: string
  a?: string // senza collegamento = la pagina in cui sei
}

/** "Ordini › Maria Rossi › n. 7": dove sei e come tornare indietro di un passo. */
export function Briciole({ voci }: { voci: Voce[] }) {
  return (
    <nav aria-label="Percorso" className="briciole no-stampa">
      <ol>
        {voci.map((v, i) => (
          <li key={`${v.testo}-${i}`} aria-current={v.a ? undefined : 'page'}>
            {v.a ? <Link to={v.a}>{v.testo}</Link> : <span>{v.testo}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
