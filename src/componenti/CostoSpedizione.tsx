import { useState } from 'react'
import { impostaCostoSpedizione } from '../data/ordini'
import { haSpedizione, spedizioneCent } from '../lib/calcoli'
import { centInEuroTesto, parseEuro } from '../lib/importi'
import type { Ordine } from '../lib/tipi'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

/** Il costo di spedizione che il cliente paga: si può impostare, cambiare o togliere anche dopo aver creato l'ordine. */
export function CostoSpedizione({ ordine }: { ordine: Ordine }) {
  const [testo, setTesto] = useState(haSpedizione(ordine) ? centInEuroTesto(spedizioneCent(ordine)) : '')
  const [errore, setErrore] = useState('')
  const [fatto, setFatto] = useState('')

  async function salva() {
    setFatto('')
    if (!testo.trim()) return setErrore('Scrivi l\'importo (0 se la spedizione è gratuita) oppure usa «Togli la spedizione».')
    const cent = parseEuro(testo)
    if (cent === null) return setErrore('Importo non valido: scrivi per esempio 5,90.')
    setErrore('')
    try {
      await impostaCostoSpedizione(ordine.id, cent)
      setFatto('Costo di spedizione salvato')
    } catch {
      setErrore(ERRORE_SCRITTURA)
    }
  }

  async function togli() {
    setFatto('')
    setErrore('')
    try {
      await impostaCostoSpedizione(ordine.id, null)
      setTesto('')
      setFatto('Spedizione tolta dall\'ordine')
    } catch {
      setErrore(ERRORE_SCRITTURA)
    }
  }

  return (
    <div>
      <label htmlFor={`costo-sped-${ordine.id}`}>Costo di spedizione per il cliente (€)</label>
      <input id={`costo-sped-${ordine.id}`} inputMode="decimal" value={testo} onChange={(e) => setTesto(e.target.value)} />
      <p className="nota">Si somma al totale e compare nel messaggio WhatsApp e nel PDF. 0 = «spedizione gratuita».</p>
      {errore && <p className="errore" role="alert">{errore}</p>}
      {fatto && <p role="status">{fatto}</p>}
      <div className="azioni">
        <button type="button" onClick={() => void salva()}>Salva il costo</button>
        {haSpedizione(ordine) && <button type="button" className="secondario" onClick={() => void togli()}>Togli la spedizione</button>}
      </div>
    </div>
  )
}
