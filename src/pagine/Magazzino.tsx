import { useEffect, useState, type FormEvent } from 'react'
import { SchedaArticolo } from '../componenti/SchedaArticolo'
import { ascoltaArticoli, creaArticolo } from '../data/magazzino'
import { parseEuro } from '../lib/importi'
import { filtraArticoli } from '../lib/magazzino'
import { ETICHETTE_TIPO, TIPI_ARTICOLO, type Articolo, type TipoArticolo } from '../lib/tipi'
import { ETICHETTE_UNITA, parseQuantita, UNITA, type Unita } from '../lib/unita'

const ERRORE_SCRITTURA = 'Non sono riuscito a salvare. Controlla la connessione e riprova.'
const PLURALE: Record<TipoArticolo, string> = { materiale: 'Materiali', prodotto: 'Prodotti' }

function NuovoArticolo({ onFatto }: { onFatto: () => void }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoArticolo>('materiale')
  const [unita, setUnita] = useState<Unita>('pezzi')
  const [prezzo, setPrezzo] = useState('')
  const [iniziale, setIniziale] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function crea(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErrore('Scrivi il nome dell\'articolo')
    let prezzoCent: number | undefined
    if (tipo === 'prodotto') {
      const p = parseEuro(prezzo)
      if (p === null) return setErrore('Un prodotto ha bisogno del prezzo di vendita')
      prezzoCent = p
    }
    let giacenza = 0
    if (iniziale.trim()) {
      const q = parseQuantita(iniziale, unita)
      if (q === null) return setErrore(`La giacenza iniziale non è valida in ${unita}`)
      giacenza = q
    }
    setErrore('')
    setInvio(true)
    try {
      await creaArticolo({ nome: nome.trim(), tipo, unita, attivo: true, ...(prezzoCent !== undefined ? { prezzoCent } : {}) }, giacenza)
      onFatto()
    } catch {
      setErrore(ERRORE_SCRITTURA)
      setInvio(false)
    }
  }

  return (
    <form className="scheda" onSubmit={(e) => void crea(e)} aria-label="Nuovo articolo">
      <h2>Nuovo articolo</h2>
      <label htmlFor="na-nome">Nome</label>
      <input id="na-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="griglia2">
        <div>
          <label htmlFor="na-tipo">Tipo</label>
          <select
            id="na-tipo"
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
          <label htmlFor="na-unita">Unità di misura</label>
          <select id="na-unita" value={unita} disabled={tipo === 'prodotto'} onChange={(e) => setUnita(e.target.value as Unita)}>
            {UNITA.map((u) => <option key={u} value={u}>{ETICHETTE_UNITA[u]}</option>)}
          </select>
        </div>
      </div>
      <p className="nota">
        {tipo === 'materiale'
          ? 'Materiale: quello che consumi per fare i tuoi prodotti (cera, stoppini, nastro…).'
          : 'Prodotto: quello che vendi, sempre a pezzi. Compare nella scelta dei prodotti quando crei un ordine.'}
      </p>
      {tipo === 'prodotto' && (
        <>
          <label htmlFor="na-prezzo">Prezzo di vendita (€ per {unita === 'pezzi' ? 'pezzo' : unita})</label>
          <input id="na-prezzo" inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
        </>
      )}
      <label htmlFor="na-iniziale">Giacenza iniziale in {unita} (facoltativa)</label>
      <input id="na-iniziale" inputMode="decimal" value={iniziale} onChange={(e) => setIniziale(e.target.value)} />
      {errore && <p className="errore" role="alert">{errore}</p>}
      <p><button type="submit" disabled={invio}>Aggiungi al magazzino</button></p>
    </form>
  )
}

export default function Magazzino() {
  const [articoli, setArticoli] = useState<Articolo[]>([])
  const [ricerca, setRicerca] = useState('')
  const [tipo, setTipo] = useState<TipoArticolo | ''>('')
  const [disattivati, setDisattivati] = useState(false)
  const [nuovo, setNuovo] = useState(false)

  useEffect(() => ascoltaArticoli(setArticoli), [])

  const inUso = disattivati ? articoli : articoli.filter((a) => a.attivo)
  const visibili = filtraArticoli(inUso, ricerca, tipo)
  const conta = (t: TipoArticolo | '') => inUso.filter((a) => !t || a.tipo === t).length
  const nascosti = articoli.length - articoli.filter((a) => a.attivo).length

  return (
    <main className="pagina">
      <div className="riga">
        <h1>Magazzino</h1>
        <button type="button" onClick={() => setNuovo(!nuovo)}>{nuovo ? 'Chiudi' : '+ Nuovo articolo'}</button>
      </div>
      <p>Cosa hai in magazzino e quanto ne resta. I <strong>prodotti</strong> si vendono, i <strong>materiali</strong> si consumano.</p>

      {nuovo && <NuovoArticolo onFatto={() => setNuovo(false)} />}

      <label htmlFor="cerca-magazzino">Cerca nel magazzino</label>
      <input id="cerca-magazzino" autoComplete="off" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />

      <div className="linguette" role="group" aria-label="Tipo di articolo" style={{ marginTop: '.75rem' }}>
        {(['', ...TIPI_ARTICOLO] as const).map((t) => (
          <button key={t || 'tutti'} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}>
            {t ? PLURALE[t] : 'Tutti'} ({conta(t)})
          </button>
        ))}
      </div>
      {nascosti > 0 && (
        <label className="spunta">
          <input type="checkbox" checked={disattivati} onChange={(e) => setDisattivati(e.target.checked)} /> Mostra anche i disattivati ({nascosti})
        </label>
      )}

      <div style={{ marginTop: '.75rem' }}>
        {articoli.length === 0 && <p>Il magazzino è vuoto. Aggiungi il primo articolo con «+ Nuovo articolo».</p>}
        {articoli.length > 0 && visibili.length === 0 && <p>Nessun articolo corrisponde.</p>}
        {visibili.map((a) => <SchedaArticolo key={a.id} articolo={a} />)}
      </div>
    </main>
  )
}
