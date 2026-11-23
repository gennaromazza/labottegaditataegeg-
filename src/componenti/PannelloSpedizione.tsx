import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { aggiornaOrdine } from '../data/ordini'
import { oggiISO } from '../data/util'
import { formatData } from '../lib/calcoli'
import { puoCambiareStato } from '../lib/stati'
import type { Ordine, Spedizione } from '../lib/tipi'
import { linkSpedizione } from '../lib/whatsapp'

const ERRORE = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

interface Props {
  ordine: Ordine
  indirizzo?: Spedizione
}

/** Per un ordine pronto: dati del corriere e "Segna come spedito". Per uno spedito: avviso al cliente su WhatsApp. */
export function PannelloSpedizione({ ordine, indirizzo }: Props) {
  const [corriere, setCorriere] = useState(ordine.corriere ?? '')
  const [tracking, setTracking] = useState(ordine.tracking ?? '')
  const [errore, setErrore] = useState('')
  const [salvato, setSalvato] = useState(false)
  const spedito = ordine.stato === 'spedito'

  async function salva(e: FormEvent) {
    e.preventDefault()
    setSalvato(false)
    const datiCorriere = { corriere: corriere.trim(), tracking: tracking.trim() }
    try {
      if (spedito) {
        await aggiornaOrdine(ordine.id, datiCorriere)
        setErrore('')
        setSalvato(true)
        return
      }
      const esito = puoCambiareStato(ordine, 'spedito')
      if (!esito.ok) return setErrore(esito.motivo)
      setErrore('')
      await aggiornaOrdine(ordine.id, { stato: 'spedito', ...datiCorriere, dataSpedizione: ordine.dataSpedizione ?? oggiISO() })
    } catch {
      setErrore(ERRORE)
    }
  }

  const link = spedito ? linkSpedizione(ordine, indirizzo) : null
  const idc = `corriere-${ordine.id}`
  const idt = `tracking-${ordine.id}`

  return (
    <div aria-label="Spedizione">
      {spedito && (
        <p role="status">
          <strong>Spedito{ordine.dataSpedizione ? ` il ${formatData(ordine.dataSpedizione)}` : ''}.</strong> Ora avvisa il cliente:
        </p>
      )}
      {spedito && (
        <div className="azioni">
          {link ? (
            <a className="bottone" href={link} target="_blank" rel="noopener noreferrer">Avvisa la spedizione su WhatsApp</a>
          ) : (
            <>
              <button type="button" disabled>Avvisa la spedizione su WhatsApp</button>
              <small>Aggiungi il telefono del cliente</small>
            </>
          )}
          <Link
            className="bottone secondario-link"
            to={`/spese?categoria=Spedizioni&descrizione=${encodeURIComponent(`Spedizione ordine n. ${ordine.numero}`)}`}
          >
            Registra il costo della spedizione
          </Link>
        </div>
      )}
      <form onSubmit={(e) => void salva(e)} aria-label="Dati di spedizione dell'ordine">
        <div className="griglia2">
          <div>
            <label htmlFor={idc}>Corriere (facoltativo)</label>
            <input id={idc} value={corriere} onChange={(e) => setCorriere(e.target.value)} />
          </div>
          <div>
            <label htmlFor={idt}>Codice di tracciamento (facoltativo)</label>
            <input id={idt} value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
        </div>
        {errore && <p className="errore" role="alert">{errore}</p>}
        {salvato && <p role="status">Dati salvati. Il messaggio WhatsApp li usa.</p>}
        <p><button type="submit">{spedito ? 'Aggiorna i dati' : 'Segna come spedito'}</button></p>
      </form>
    </div>
  )
}
