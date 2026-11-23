import { useEffect, useState, type FormEvent } from 'react'
import { ascoltaListino, salvaVoceListino, type VoceListino } from '../data/listino'
import { centInEuroTesto, parseEuro } from '../lib/importi'

function VoceRiga({ voce }: { voce: VoceListino }) {
  const [prezzo, setPrezzo] = useState(centInEuroTesto(voce.prezzoCent))
  const [errore, setErrore] = useState('')

  async function salvaPrezzo() {
    const cent = parseEuro(prezzo)
    if (cent === null) return setErrore('Prezzo non valido')
    setErrore('')
    await salvaVoceListino({ ...voce, prezzoCent: cent })
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

  useEffect(() => ascoltaListino(setVoci), [])

  async function aggiungi(e: FormEvent) {
    e.preventDefault()
    const cent = parseEuro(prezzo)
    if (!nome.trim() || cent === null) return setErrore('Scrivi il nome e un prezzo valido')
    setErrore('')
    await salvaVoceListino({ nome: nome.trim(), prezzoCent: cent, attivo: true })
    setNome('')
    setPrezzo('')
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
      {voci.map((v) => <VoceRiga key={v.id} voce={v} />)}
    </main>
  )
}
