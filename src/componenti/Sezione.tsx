import { useId, useState, type ReactNode } from 'react'

interface Props {
  titolo: string
  conteggio?: number
  /** Aperta all'inizio? Di default chiusa: con molti dati una schermata tutta aperta è scomoda. */
  aperta?: boolean
  /** Se c'è, la scelta dell'utente (aperta o chiusa) si ricorda finché dura la sessione, anche cambiando pagina. */
  ricorda?: string
  children: ReactNode
}

const chiave = (nome: string) => `sezione:${nome}`

function leggi(nome: string | undefined): boolean | null {
  if (!nome) return null
  try {
    const v = sessionStorage.getItem(chiave(nome))
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null // memoria non disponibile (navigazione privata): si parte dal valore di default
  }
}

function salva(nome: string | undefined, aperto: boolean) {
  if (!nome) return
  try {
    sessionStorage.setItem(chiave(nome), aperto ? '1' : '0')
  } catch {
    // niente: la sezione funziona lo stesso, solo non si ricorda
  }
}

/** Una parte della schermata che si apre e si chiude con un tocco. */
export function Sezione({ titolo, conteggio, aperta = false, ricorda, children }: Props) {
  const [aperto, setAperto] = useState(() => leggi(ricorda) ?? aperta)
  const pannello = useId()

  function cambia() {
    const nuovo = !aperto
    setAperto(nuovo)
    salva(ricorda, nuovo)
  }

  return (
    <section className="sezione">
      <h2 className="sezione-titolo">
        <button type="button" aria-expanded={aperto} aria-controls={pannello} onClick={cambia}>
          <span>{titolo}{conteggio !== undefined ? ` (${conteggio})` : ''}</span>
          <span aria-hidden="true" className="sezione-freccia">{aperto ? '▾' : '▸'}</span>
        </button>
      </h2>
      <div id={pannello} hidden={!aperto}>
        {aperto && children}
      </div>
    </section>
  )
}
