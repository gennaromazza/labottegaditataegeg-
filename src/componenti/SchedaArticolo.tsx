import { useState } from 'react'
import { formatEuro } from '../lib/calcoli'
import { ETICHETTE_TIPO, type Articolo } from '../lib/tipi'
import { formatQuantitaComoda } from '../lib/unita'
import { ModificaArticolo } from './ModificaArticolo'
import { RicettaArticolo } from './RicettaArticolo'
import { MovimentoArticolo } from './MovimentoArticolo'

export function SchedaArticolo({ articolo, tutti = [] }: { articolo: Articolo; tutti?: Articolo[] }) {
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
      <p className="giacenza" aria-label={`Giacenza di ${articolo.nome}`}>{formatQuantitaComoda(articolo.giacenza, articolo.unita)}</p>
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
          {articolo.tipo === 'prodotto' && <RicettaArticolo key={`r-${articolo.id}`} prodotto={articolo} tutti={tutti} />}
          <ModificaArticolo articolo={articolo} />
        </div>
      )}
    </article>
  )
}
