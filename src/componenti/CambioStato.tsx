import { useRef, useState } from 'react'
import { cambiaStatoOrdine } from '../data/ordini'
import { ErroreMateriali, fabbisogno, testoMancante, verificaDisponibilita, type Mancante } from '../lib/ricette'
import { ErroreRegola, puoCambiareStato } from '../lib/stati'
import type { Ordine, StatoOrdine } from '../lib/tipi'
import { useArticoli } from './ArticoliContext'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

type Extra = Partial<Omit<Ordine, 'id' | 'numero'>>

interface Avviso {
  nuovo: StatoOrdine
  mancanti: Mancante[]
  problemi: string[]
  extra?: Extra
}

/**
 * Cambio di stato con le regole dell'acconto e il controllo dei materiali.
 * Prima di "In preparazione" confronta i materiali della ricetta con il magazzino: se mancano, non cambia nulla
 * e restituisce un `avviso` da mostrare con <AvvisoMateriali>, dove si sceglie se procedere comunque.
 */
export function useCambioStato(ordine: Ordine | null | undefined) {
  const articoli = useArticoli()
  const [avviso, setAvviso] = useState<Avviso | null>(null)
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)
  const inCorso = useRef(false) // un secondo tocco mentre il primo è in corso non deve partire

  async function esegui(nuovo: StatoOrdine, extra?: Extra, procediComunque = false): Promise<boolean> {
    if (inCorso.current) return false
    setErrore('')
    if (!ordine) return false // la pagina non ha ancora caricato l'ordine
    const esito = puoCambiareStato(ordine, nuovo)
    if (!esito.ok) {
      setErrore(esito.motivo)
      return false
    }
    // controllo preventivo con i dati già in memoria, così l'avviso compare subito
    if (nuovo === 'in preparazione' && !ordine.scaricoMagazzino && !procediComunque) {
      const f = fabbisogno(ordine.righe, articoli)
      const v = verificaDisponibilita(f.voci, articoli)
      if (!v.ok) {
        setAvviso({ nuovo, mancanti: v.mancanti, problemi: f.problemi, extra })
        return false
      }
    }
    inCorso.current = true
    setOccupato(true)
    try {
      await cambiaStatoOrdine(ordine.id, nuovo, { procediComunque, extra })
      setAvviso(null)
      return true
    } catch (e) {
      if (e instanceof ErroreMateriali) setAvviso({ nuovo, mancanti: e.mancanti, problemi: [], extra })
      else setErrore(e instanceof ErroreRegola ? e.message : ERRORE_SCRITTURA)
      return false
    } finally {
      inCorso.current = false
      setOccupato(false)
    }
  }

  return {
    cambia: (nuovo: StatoOrdine, extra?: Extra) => esegui(nuovo, extra),
    procediComunque: () => (avviso ? esegui(avviso.nuovo, avviso.extra, true) : Promise.resolve(false)),
    ferma: () => setAvviso(null),
    avviso,
    errore,
    occupato,
  }
}

/** "Mancano materiali": elenca cosa manca e lascia scegliere se procedere comunque o fermarsi a riordinare. */
export function AvvisoMateriali({
  avviso,
  onProcedi,
  onFerma,
  occupato = false,
}: {
  avviso: Avviso | null
  onProcedi: () => void
  onFerma: () => void
  occupato?: boolean
}) {
  if (!avviso) return null
  return (
    <div className="avviso" role="alertdialog" aria-label="Materiali che mancano">
      <p><strong>Mancano dei materiali per questo ordine:</strong></p>
      <ul>
        {avviso.mancanti.map((m) => <li key={m.articoloId}>{testoMancante(m)}</li>)}
      </ul>
      {avviso.problemi.map((p) => <p key={p} className="nota">{p}</p>)}
      <div className="azioni">
        <button type="button" disabled={occupato} onClick={onProcedi}>Procedi comunque</button>
        <button type="button" className="secondario" onClick={onFerma}>Ferma, riordino</button>
      </div>
      <p className="nota">«Procedi comunque» scala quello che c&apos;è e annota nello storico cosa mancava.</p>
    </div>
  )
}
