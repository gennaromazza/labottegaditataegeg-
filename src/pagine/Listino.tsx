import { useEffect, useState, type FormEvent } from 'react'
import { ascoltaListino, salvaVoceListino, type VoceListino } from '../data/listino'
import { centInEuroTesto, parseEuro } from '../lib/importi'
import { normalizza } from '../lib/testo'

function VoceRiga({ voce }: { voce: VoceListino }) {
  const [prezzo, setPrezzo] = useState(centInEuroTesto(voce.prezzoCent))
  const [errore, setErrore] = useState('')

  async function salvaPrezzo() {
    const cent = parseEuro(prezzo)
    if (cent === null) return setErrore('Prezzo non valido')
    setErrore('')
    try {
      await salvaVoceListino({ ...voce, prezzoCent: cent })
    } catch {
      setErrore('Non sono riuscito a salvare. Controlla la connessione e riprova.')
    }
  }

  return (
    <div className="scheda">
      <div className="riga">
        <strong>{voce.nome}</strong>
        <span className={`badge ${voce.attivo ? 'ok' : ''}`}>{voce.attivo ? 'In listino' : 'Disattivato'}</span>
      </div>
      <label htmlFor={`prz-${voce.id}`}>Prezzo di {voce.nome} (€)</label>
      <input id={`prz-${voce.id}`} inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
      {errore && <p className="errore" role="alert">{errore}</p>}
      <div className="azioni">
        <button type="button" onClick={() => void salvaPrezzo()} aria-label={`Salva prezzo di ${voce.nome}`}>Salva prezzo</button>
        <button type="button" className="secondario" onClick={() => void salvaVoceListino({ ...voce, attivo: !voce.attivo })}>
          {voce.attivo ? 'Disattiva' : 'Riattiva'} {voce.nome}
        </button>
      </div>
    </div>
  )
}

export default function Listino() {
  const [voci, setVoci] = useState<VoceListino[]>([])
  const [nome, setNome] = useState('')
  const [prezzo, setPrezzo] = useState('')
  const [errore, setErrore] = useState('')
  const [ricerca, setRicerca] = useState('')

  useEffect(() => ascoltaListino(setVoci), [])

  const q = normalizza(ricerca)
  const visibili = q ? voci.filter((v) => normalizza(v.nome).includes(q)) : voci

  async function aggiungi(e: FormEvent) {
    e.preventDefault()
    const cent = parseEuro(prezzo)
    if (!nome.trim() || cent === null) return setErrore('Scrivi il nome e un prezzo valido')
    setErrore('')
    try {
      await salvaVoceListino({ nome: nome.trim(), prezzoCent: cent, attivo: true })
      setNome('')
      setPrezzo('')
    } catch {
      setErrore('Non sono riuscito a salvare. Controlla la connessione e riprova.')
    }
  }

  return (
    <main className="pagina">
      <h1>Listino</h1>
      <p>I prodotti che vendi più spesso, con il prezzo già pronto quando crei un ordine.</p>
      <form className="scheda" onSubmit={(e) => void aggiungi(e)} aria-label="Nuovo prodotto">
        <label htmlFor="lst-nome">Nome del prodotto</label>
        <input id="lst-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <label htmlFor="lst-prz">Prezzo (€)</label>
        <input id="lst-prz" inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
        {errore && <p className="errore" role="alert">{errore}</p>}
        <p><button type="submit">Aggiungi al listino</button></p>
      </form>
      <label htmlFor="cerca-voci">Cerca nel listino</label>
      <input id="cerca-voci" autoComplete="off" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
      <div style={{ marginTop: '.75rem' }}>
        {visibili.length === 0 && <p>{voci.length === 0 ? 'Il listino è vuoto.' : 'Nessun prodotto corrisponde alla ricerca.'}</p>}
        {visibili.map((v) => <VoceRiga key={v.id} voce={v} />)}
      </div>
    </main>
  )
}
