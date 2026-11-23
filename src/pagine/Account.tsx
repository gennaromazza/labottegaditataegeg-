import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

const MINIMO = 8

function messaggioErrore(e: unknown): string {
  const codice = (e as { code?: string }).code ?? ''
  if (codice === 'auth/wrong-password' || codice === 'auth/invalid-credential') return 'La password attuale non è corretta'
  if (codice === 'auth/too-many-requests') return 'Troppi tentativi: riprova tra qualche minuto'
  if (codice === 'auth/weak-password') return `La nuova password è troppo debole: usa almeno ${MINIMO} caratteri`
  if (codice === 'auth/network-request-failed') return 'Connessione assente: riprova quando sei online'
  return 'Non sono riuscito a cambiare la password. Riprova.'
}

export default function Account() {
  const { utente, cambiaPassword, esci } = useAuth()
  const [attuale, setAttuale] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')
  const [fatto, setFatto] = useState(false)
  const [invio, setInvio] = useState(false)

  async function invia(e: FormEvent) {
    e.preventDefault()
    setFatto(false)
    if (nuova.length < MINIMO) return setErrore(`La nuova password deve avere almeno ${MINIMO} caratteri`)
    if (nuova !== conferma) return setErrore('Le due password nuove non coincidono')
    if (nuova === attuale) return setErrore('La nuova password deve essere diversa da quella attuale')
    setErrore('')
    setInvio(true)
    try {
      await cambiaPassword(attuale, nuova)
      setAttuale('')
      setNuova('')
      setConferma('')
      setFatto(true)
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  return (
    <main className="pagina">
      <h1>Account</h1>
      <p>Sei collegato come <strong>{utente?.email}</strong></p>

      <form className="scheda" onSubmit={(e) => void invia(e)} aria-label="Cambia password">
        <h2>Cambia password</h2>
        <label htmlFor="pw-att">Password attuale</label>
        <input id="pw-att" type="password" autoComplete="current-password" value={attuale} onChange={(e) => setAttuale(e.target.value)} required />
        <label htmlFor="pw-new">Nuova password (almeno {MINIMO} caratteri)</label>
        <input id="pw-new" type="password" autoComplete="new-password" value={nuova} onChange={(e) => setNuova(e.target.value)} required />
        <label htmlFor="pw-conf">Ripeti la nuova password</label>
        <input id="pw-conf" type="password" autoComplete="new-password" value={conferma} onChange={(e) => setConferma(e.target.value)} required />
        {errore && <p className="errore" role="alert">{errore}</p>}
        {fatto && <p role="status">Password cambiata</p>}
        <p><button type="submit" disabled={invio}>Cambia password</button></p>
      </form>

      <p><button type="button" className="secondario" onClick={() => void esci()}>Esci</button></p>
    </main>
  )
}
