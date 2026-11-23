import { avvisiOrdine, prossimaAzione } from '../lib/stati'
import type { Ordine, Spedizione } from '../lib/tipi'
import { AvvisoMateriali, useCambioStato } from './CambioStato'
import { MaterialiOrdine } from './MaterialiOrdine'
import { NotePreparazione } from './NotePreparazione'
import { PannelloSpedizione } from './PannelloSpedizione'

interface Props {
  ordine: Ordine
  indirizzo?: Spedizione
}

/** Tutto quello che serve per far avanzare un ordine: avvisi, materiali, note di preparazione, passo successivo, spedizione. */
export function AvanzamentoOrdine({ ordine, indirizzo }: Props) {
  const { cambia, procediComunque, ferma, avviso, errore, occupato } = useCambioStato(ordine)
  const azione = prossimaAzione(ordine)
  const avvisi = avvisiOrdine(ordine)
  const inLavorazione = ordine.stato === 'confermato' || ordine.stato === 'in preparazione' || ordine.stato === 'pronto'
  const conSpedizione = ordine.stato === 'pronto' || ordine.stato === 'spedito'

  return (
    <div>
      {avvisi.map((a) => <p className="avviso" role="status" key={a}>{a}</p>)}
      <MaterialiOrdine ordine={ordine} />
      <AvvisoMateriali avviso={avviso} onProcedi={() => void procediComunque()} onFerma={ferma} occupato={occupato} />
      {(inLavorazione || ordine.notePreparazione) && <NotePreparazione key={`n-${ordine.id}`} ordine={ordine} />}
      {conSpedizione && <PannelloSpedizione key={`s-${ordine.id}`} ordine={ordine} indirizzo={indirizzo} />}
      {azione && ordine.stato !== 'pronto' && (
        <p><button type="button" disabled={occupato} onClick={() => void cambia(azione.stato)}>{azione.etichetta}</button></p>
      )}
      {errore && <p className="errore" role="alert">{errore}</p>}
    </div>
  )
}
