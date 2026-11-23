import { useState } from 'react'
import { formatEuro } from '../lib/calcoli'
import { ETICHETTE_TIPO, type Articolo } from '../lib/tipi'
import { formatQuantita } from '../lib/unita'
import { ModificaArticolo } from './ModificaArticolo'
import { MovimentoArticolo } from './MovimentoArticolo'

export function SchedaArticolo({ articolo }: { articolo: Articolo }) {
  const [aperto, setAperto] = useState(false)
  const pannello = `pannello-${articolo.id}`
  return (
    <article className="scheda" aria-label={`Articolo ${articolo.nome}`}>
      <div className="riga">
        <strong>{articolo.nome}</strong>
        <span>
          <span className={`badge ${articolo.tipo === 'prodotto' ? 'info' : ''}`.trim()}>{ETICHETTE_TIPO[articolo.tipo]}</span>
          {!articolo.attivo && <> <span className="badge spento">Disattivato</span></>}
        </span>
      </div>
      <p className="giacenza" aria-label={`Giacenza di ${articolo.nome}`}>{formatQuantita(articolo.giacenza, articolo.unita)}</p>
      {articolo.tipo === 'prodotto' && articolo.prezzoCent !== undefined && (
        <p className="nota">{formatEuro(articolo.prezzoCent)} al {articolo.unita === 'pezzi' ? 'pezzo' : articolo.unita}</p>
      )}
      <p>
        <button
          type="button"
          className="secondario"
          aria-expanded={aperto}
          aria-controls={pannello}
          onClick={() => setAperto(!aperto)}
        >
          {aperto ? 'Chiudi' : 'Gestisci'} <span className="solo-lettura">{articolo.nome}</span>
        </button>
      </p>
      {aperto && (
        <div id={pannello}>
          <MovimentoArticolo articolo={articolo} />
          <ModificaArticolo articolo={articolo} />
        </div>
      )}
    </article>
  )
}
