import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const ICONE: Record<string, ReactNode> = {
  ordini: (
    <>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  clienti: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2A5 5 0 0 1 21 19" />
    </>
  ),
  incassi: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5a3.5 3.5 0 1 0 0 5M8 11h5M8 13h5" />
    </>
  ),
  spese: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  listino: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
}

const VOCI = [
  { a: '/ordini', t: 'Ordini', i: 'ordini' },
  { a: '/clienti', t: 'Clienti', i: 'clienti' },
  { a: '/incassi', t: 'Incassi', i: 'incassi' },
  { a: '/spese', t: 'Spese', i: 'spese' },
  { a: '/listino', t: 'Listino', i: 'listino' },
  { a: '/account', t: 'Account', i: 'account' },
]

export function Guscio() {
  const { esci } = useAuth()
  return (
    <div className="guscio">
      <nav className="menu" aria-label="Menu principale">
        <img src="/logo.png" alt="La Bottega di Tata e Gegè" className="menu-logo" />
        {VOCI.map((v) => (
          <NavLink key={v.a} to={v.a} className={({ isActive }) => (isActive ? 'attiva' : '')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONE[v.i]}
            </svg>
            <span>{v.t}</span>
          </NavLink>
        ))}
        <button className="secondario esci" onClick={() => void esci()}>Esci</button>
      </nav>
      <div className="contenuto"><Outlet /></div>
    </div>
  )
}
