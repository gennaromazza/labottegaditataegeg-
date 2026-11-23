import { useState } from 'react'
import { aggiornaOrdine } from '../data/ordini'
import type { Ordine } from '../lib/tipi'

export function NotePreparazione({ ordine }: { ordine: Ordine }) {
  const [testo, setTesto] = useState(ordine.notePreparazione ?? '')
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  async function salva() {
    setErrore('')
    try {
      await aggiornaOrdine(ordine.id, { notePreparazione: testo.trim() })
      setSalvato(true)
    } catch {
      setErrore('Non sono riuscito a salvare le note. Controlla la connessione e riprova.')
    }
  }

  const campo = `note-prep-${ordine.id}`
  return (
    <div>
      <label htmlFor={campo}>Note di preparazione</label>
      <textarea
        id={campo}
        value={testo}
        placeholder="Es. colore scelto, a che punto sei, cosa manca…"
        onChange={(e) => {
          setTesto(e.target.value)
          setSalvato(false)
        }}
      />
      {errore && <p className="errore" role="alert">{errore}</p>}
      {salvato && <p role="status">Note salvate</p>}
      <p><button type="button" className="secondario" onClick={() => void salva()}>Salva note</button></p>
    </div>
  )
}
