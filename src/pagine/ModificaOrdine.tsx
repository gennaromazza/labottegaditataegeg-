import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ascoltaOrdine } from '../data/ordini'
import type { Ordine } from '../lib/tipi'
import OrdineForm from './OrdineForm'

/** /ordini/<id>/modifica: carica l'ordine e apre il modulo già compilato. */
export default function ModificaOrdine() {
  const { id = '' } = useParams()
  const [ordine, setOrdine] = useState<Ordine | null | undefined>(undefined)

  // si legge una volta sola: mentre l'utente scrive, il modulo non deve cambiare sotto le sue mani
  useEffect(() => {
    let letto = false
    const smetti = ascoltaOrdine(id, (o) => {
      if (letto) return
      letto = true
      setOrdine(o)
    })
    return smetti
  }, [id])

  if (ordine === undefined) return <main className="pagina">Caricamento…</main>
  if (ordine === null) {
    return (
      <main className="pagina">
        <p>Ordine non trovato.</p>
        <Link to="/ordini">Torna agli ordini</Link>
      </main>
    )
  }
  return <OrdineForm key={ordine.id} iniziale={ordine} />
}
