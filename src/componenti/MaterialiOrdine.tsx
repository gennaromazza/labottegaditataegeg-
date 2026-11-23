import { formatData } from '../lib/calcoli'
import { fabbisogno, formatQuantitaComoda, testoMancante, verificaDisponibilita } from '../lib/ricette'
import type { Ordine } from '../lib/tipi'
import { useArticoli } from './ArticoliContext'

/** Cosa serve per l'ordine (prima di iniziare) o cosa è stato scalato dal magazzino (dopo). Niente se non ci sono ricette. */
export function MaterialiOrdine({ ordine }: { ordine: Ordine }) {
  const articoli = useArticoli()

  if (ordine.scaricoMagazzino) {
    const { data, voci } = ordine.scaricoMagazzino
    return (
      <div aria-label="Materiali dell'ordine">
        <p><strong>Materiali scalati dal magazzino</strong> il {formatData(data)}:</p>
        <ul>
          {voci.map((v) => (
            <li key={v.articoloId}>
              {v.nome}: {formatQuantitaComoda(v.scalata, v.unita)}
              {v.necessaria > v.scalata ? ` (ne mancavano ${formatQuantitaComoda(v.necessaria - v.scalata, v.unita)})` : ''}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (ordine.stato === 'annullato' || ordine.stato === 'consegnato' || ordine.stato === 'spedito') return null
  const f = fabbisogno(ordine.righe, articoli)
  if (f.voci.length === 0) return null
  const v = verificaDisponibilita(f.voci, articoli)
  return (
    <div aria-label="Materiali dell'ordine">
      <p><strong>Materiali che serviranno:</strong> {f.voci.map((x) => `${x.nome} ${formatQuantitaComoda(x.necessaria, x.unita)}`).join(', ')}</p>
      {v.ok ? (
        <p role="status">In magazzino ce n&apos;è abbastanza.</p>
      ) : (
        <p className="avviso" role="status">Non bastano: {v.mancanti.map(testoMancante).join('; ')}</p>
      )}
      {f.problemi.map((p) => <p key={p} className="nota">{p}</p>)}
    </div>
  )
}
