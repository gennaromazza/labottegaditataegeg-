import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RottaProtetta() {
  const { utente, caricamento } = useAuth()
  if (caricamento) return <p className="pagina">Caricamento…</p>
  if (!utente) return <Navigate to="/login" replace />
  return <Outlet />
}
