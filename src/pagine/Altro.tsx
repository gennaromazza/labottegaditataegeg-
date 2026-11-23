import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const VOCI = [
  { a: '/spese', t: 'Spese', d: 'Registra le spese e vedi quanto spendi, spedizioni comprese' },
  { a: '/listino', t: 'Listino', d: 'I tuoi prodotti con i prezzi già pronti' },
  { a: '/account', t: 'Account', d: 'Cambia la tua password' },
]

/** La voce "Altro" del menu su telefono: raccoglie ciò che non sta nella barra in basso. */
export default function Altro() {
  const { esci } = useAuth()
  return (
    <main className="pagina">
      <h1>Altro</h1>
      {VOCI.map((v) => (
        <Link key={v.a} to={v.a} className="scheda link-scheda">
          <strong>{v.t}</strong>
          <div>{v.d}</div>
        </Link>
      ))}
      <p><button type="button" className="secondario" onClick={() => void esci()}>Esci</button></p>
    </main>
  )
}
