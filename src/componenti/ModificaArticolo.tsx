import { useState, type FormEvent } from 'react'
import { aggiornaArticolo } from '../data/magazzino'
import { centInEuroTesto, parseEuro } from '../lib/importi'
import { ETICHETTE_TIPO, TIPI_ARTICOLO, type Articolo, type TipoArticolo } from '../lib/tipi'
import { ETICHETTE_UNITA, formatQuantita, UNITA, unitaCambiabile, type Unita } from '../lib/unita'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'

export function ModificaArticolo({ articolo }: { articolo: Articolo }) {
  const [nome, setNome] = useState(articolo.nome)
  const [tipo, setTipo] = useState<TipoArticolo>(articolo.tipo)
  const [unita, setUnita] = useState<Unita>(articolo.unita)
  const [prezzo, setPrezzo] = useState(articolo.prezzoCent !== undefined ? centInEuroTesto(articolo.prezzoCent) : '')
  const [attivo, setAttivo] = useState(articolo.attivo)
  const [errore, setErrore] = useState('')
  const [salvato, setSalvato] = useState(false)

  async function salva(e: FormEvent) {
    e.preventDefault()
    setSalvato(false)
    if (!nome.trim()) return setErrore('Scrivi il nome dell\'articolo')
    if (!unitaCambiabile(articolo.unita, unita, articolo.giacenza)) {
      return setErrore('Non puoi passare da una famiglia di unità a un\'altra finché c\'è giacenza (per esempio da pezzi a grammi). Prima porta la giacenza a zero.')
    }
    if (tipo === 'prodotto' && unita !== 'pezzi') {
      return setErrore('I prodotti si vendono a pezzi. Metti l\'unità "Pezzi" oppure scegli il tipo "Materiale".')
    }
    if (articolo.attivo && !attivo && articolo.giacenza > 0) {
      const resta = formatQuantita(articolo.giacenza, articolo.unita)
      if (!window.confirm(`Di "${articolo.nome}" ne restano ${resta}. Disattivarlo comunque? Sparisce dalle proposte, la giacenza resta.`)) return
    }
    let prezzoCent: number | undefined
    if (tipo === 'prodotto') {
      const p = parseEuro(prezzo)
      if (p === null) return setErrore('Un prodotto ha bisogno del prezzo di vendita')
      prezzoCent = p
    }
    setErrore('')
    try {
      await aggiornaArticolo(articolo.id, { nome: nome.trim(), tipo, unita, attivo, ...(prezzoCent !== undefined ? { prezzoCent } : {}) })
      setSalvato(true)
    } catch {
      setErrore(ERRORE_SCRITTURA)
    }
  }

  const id = (c: string) => `${c}-${articolo.id}`
  return (
    <form onSubmit={(e) => void salva(e)} aria-label={`Modifica ${articolo.nome}`}>
      <h3>Modifica articolo</h3>
      <label htmlFor={id('mn')}>Nome</label>
      <input id={id('mn')} value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="griglia2">
        <div>
          <label htmlFor={id('mt')}>Tipo</label>
          <select
            id={id('mt')}
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as TipoArticolo
              setTipo(t)
              if (t === 'prodotto') setUnita('pezzi') // i prodotti si vendono a pezzi
            }}
          >
            {TIPI_ARTICOLO.map((t) => <option key={t} value={t}>{ETICHETTE_TIPO[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={id('mu')}>Unità di misura</label>
          <select id={id('mu')} value={unita} onChange={(e) => setUnita(e.target.value as Unita)}>
            {UNITA.map((u) => <option key={u} value={u}>{ETICHETTE_UNITA[u]}</option>)}
          </select>
        </div>
      </div>
      {tipo === 'prodotto' && (
        <>
          <label htmlFor={id('mp')}>Prezzo di vendita (€ per {unita === 'pezzi' ? 'pezzo' : unita})</label>
          <input id={id('mp')} inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
        </>
      )}
      <label className="spunta">
        <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} /> In uso (se lo togli sparisce dalle proposte)
      </label>
      {errore && <p className="errore" role="alert">{errore}</p>}
      {salvato && <p role="status">Modifiche salvate</p>}
      <p><button type="submit">Salva modifiche</button></p>
    </form>
  )
}
