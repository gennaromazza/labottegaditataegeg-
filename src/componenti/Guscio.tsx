import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const VOCI = [
  { a: '/ordini', t: 'Ordini' },
  { a: '/clienti', t: 'Clienti' },
  { a: '/incassi', t: 'Incassi' },
  { a: '/spese', t: 'Spese' },
  { a: '/listino', t: 'Listino' },
]

export function Guscio() {
  const { esci } = useAuth()
  return (
    <div className="guscio">
      <nav className="menu" aria-label="Menu principale">
        <img src="/logo.png" alt="La Bottega di Tata e Gegè" className="menu-logo" />
        {VOCI.map((v) => (
          <NavLink key={v.a} to={v.a} className={({ isActive }) => (isActive ? 'attiva' : '')}>
            {v.t}
          </NavLink>
        ))}
        <button className="secondario esci" onClick={() => void esci()}>Esci</button>
      </nav>
      <div className="contenuto"><Outlet /></div>
    </div>
  )
}
