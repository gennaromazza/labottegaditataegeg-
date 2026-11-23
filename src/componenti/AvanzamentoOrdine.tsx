import { useState } from 'react'
import { aggiornaOrdine } from '../data/ordini'
import { avvisiOrdine, prossimaAzione, type Azione } from '../lib/stati'
import type { Ordine, Spedizione } from '../lib/tipi'
import { NotePreparazione } from './NotePreparazione'
import { PannelloSpedizione } from './PannelloSpedizione'

interface Props {
  ordine: Ordine
  indirizzo?: Spedizione
}

/** Tutto quello che serve per far avanzare un ordine: avvisi, note di preparazione, passo successivo, spedizione. */
export function AvanzamentoOrdine({ ordine, indirizzo }: Props) {
  const [errore, setErrore] = useState('')
  const azione = prossimaAzione(ordine)
  const avvisi = avvisiOrdine(ordine)
  const inLavorazione = ordine.stato === 'confermato' || ordine.stato === 'in preparazione' || ordine.stato === 'pronto'
  const conSpedizione = ordine.stato === 'pronto' || ordine.stato === 'spedito'

  async function avanza(a: Azione) {
    setErrore('')
    try {
      await aggiornaOrdine(ordine.id, { stato: a.stato })
    } catch {
      setErrore('Non sono riuscito a salvare. Controlla la connessione e riprova.')
    }
  }

  return (
    <div>
      {avvisi.map((a) => <p className="avviso" role="status" key={a}>{a}</p>)}
      {(inLavorazione || ordine.notePreparazione) && <NotePreparazione key={`n-${ordine.id}`} ordine={ordine} />}
      {conSpedizione && <PannelloSpedizione key={`s-${ordine.id}`} ordine={ordine} indirizzo={indirizzo} />}
      {azione && ordine.stato !== 'pronto' && (
        <p><button type="button" onClick={() => void avanza(azione)}>{azione.etichetta}</button></p>
      )}
      {errore && <p className="errore" role="alert">{errore}</p>}
    </div>
  )
}
