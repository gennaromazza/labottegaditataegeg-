import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { utente, accedi } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  if (utente) return <Navigate to="/ordini" replace />

  async function invia(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    try {
      await accedi(email, password)
      navigate('/ordini')
    } catch {
      setErrore('Email o password non corretti')
    } finally {
      setInvio(false)
    }
  }

  return (
    <main className="pagina login">
      <img src="/logo.png" alt="" height={96} />
      <h1>Tratti di Bottega</h1>
      <form onSubmit={invia} className="scheda">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {errore && <p className="errore" role="alert">{errore}</p>}
        <p><button type="submit" disabled={invio}>Accedi</button></p>
      </form>
    </main>
  )
}
