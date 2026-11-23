import { useState } from 'react'
import { aggiornaArticolo } from '../data/magazzino'
import { formatQuantitaComoda, pezziRealizzabili } from '../lib/ricette'
import { ETICHETTE_UNITA, parseQuantita, unitaCompatibili, unitaPerRicetta, type Unita } from '../lib/unita'
import type { Articolo, IngredienteRicetta } from '../lib/tipi'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

interface Props {
  prodotto: Articolo
  /** Tutti gli articoli del magazzino: servono per scegliere i materiali e per contare quanti pezzi si possono fare. */
  tutti: Articolo[]
}

/** La ricetta di un Prodotto: quali Materiali (e quanti) servono per farne un pezzo. */
export function RicettaArticolo({ prodotto, tutti }: Props) {
  const [ingredienti, setIngredienti] = useState<IngredienteRicetta[]>(prodotto.ricetta ?? [])
  const [materiale, setMateriale] = useState('')
  const [quantita, setQuantita] = useState('')
  const [unita, setUnita] = useState<Unita>('pezzi')
  const [errore, setErrore] = useState('')
  const [salvato, setSalvato] = useState(false)

  const materiali = tutti.filter((a) => a.tipo === 'materiale' && a.attivo)
  const scelto = materiali.find((m) => m.id === materiale)
  const perId = new Map(tutti.map((a) => [a.id, a]))
  const modificata = JSON.stringify(ingredienti) !== JSON.stringify(prodotto.ricetta ?? [])
  const pezzi = pezziRealizzabili({ ...prodotto, ricetta: ingredienti }, tutti)

  function scegliMateriale(id: string) {
    setMateriale(id)
    const m = materiali.find((x) => x.id === id)
    if (m) setUnita(unitaPerRicetta(m.unita))
  }

  function aggiungi() {
    setSalvato(false)
    if (!scelto) return setErrore('Scegli un materiale')
    if (ingredienti.some((i) => i.articoloId === scelto.id)) return setErrore(`"${scelto.nome}" è già nella ricetta: toglilo e rimettilo con la quantità giusta`)
    const q = parseQuantita(quantita, unita)
    if (q === null || q <= 0) return setErrore(`Scrivi una quantità valida in ${unita} (maggiore di zero)`)
    setErrore('')
    setIngredienti([...ingredienti, { articoloId: scelto.id, quantita: q }])
    setMateriale('')
    setQuantita('')
  }

  async function salva() {
    setErrore('')
    try {
      await aggiornaArticolo(prodotto.id, { ricetta: ingredienti })
      setSalvato(true)
    } catch {
      setErrore(ERRORE_SCRITTURA)
    }
  }

  const idm = `ric-mat-${prodotto.id}`
  const idq = `ric-qta-${prodotto.id}`
  const idu = `ric-uni-${prodotto.id}`
  return (
    <div aria-label={`Ricetta di ${prodotto.nome}`}>
      <h3>Ricetta</h3>
      <p className="nota">I materiali che servono per fare <strong>un pezzo</strong>. Quando un ordine passa a «In preparazione» si scalano dal magazzino.</p>

      {ingredienti.length === 0 && <p>Nessuna ricetta: questo prodotto non scala nulla dal magazzino.</p>}
      {ingredienti.map((i) => {
        const m = perId.get(i.articoloId)
        return (
          <div className="riga" key={i.articoloId}>
            <span>{m ? m.nome : 'Materiale non trovato'}: <strong>{m ? formatQuantitaComoda(i.quantita, m.unita) : i.quantita}</strong></span>
            <button
              type="button"
              className="secondario"
              aria-label={`Togli ${m?.nome ?? 'materiale'} dalla ricetta`}
              onClick={() => {
                setIngredienti(ingredienti.filter((x) => x.articoloId !== i.articoloId))
                setSalvato(false)
              }}
            >
              Togli
            </button>
          </div>
        )
      })}

      {pezzi !== null && (
        <p role="status">
          Con il magazzino di oggi puoi fare <strong>{pezzi}</strong> {pezzi === 1 ? 'pezzo' : 'pezzi'}.
        </p>
      )}

      <label htmlFor={idm}>Aggiungi un materiale</label>
      <select id={idm} value={materiale} onChange={(e) => scegliMateriale(e.target.value)}>
        <option value="">Scegli…</option>
        {materiali.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      <div className="griglia2">
        <div>
          <label htmlFor={idq}>Quantità per pezzo</label>
          <input id={idq} inputMode="decimal" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
        </div>
        <div>
          <label htmlFor={idu}>Unità</label>
          <select id={idu} value={unita} onChange={(e) => setUnita(e.target.value as Unita)}>
            {(scelto ? unitaCompatibili(scelto.unita) : [unita]).map((u) => <option key={u} value={u}>{ETICHETTE_UNITA[u]}</option>)}
          </select>
        </div>
      </div>
      {errore && <p className="errore" role="alert">{errore}</p>}
      {salvato && <p role="status">Ricetta salvata</p>}
      <div className="azioni">
        <button type="button" className="secondario" onClick={aggiungi}>+ Aggiungi alla ricetta</button>
        <button type="button" disabled={!modificata} onClick={() => void salva()}>Salva ricetta</button>
      </div>
      {materiali.length === 0 && <p className="nota">Non hai ancora materiali nel magazzino: aggiungili con «+ Nuovo articolo» (tipo Materiale).</p>}
    </div>
  )
}
