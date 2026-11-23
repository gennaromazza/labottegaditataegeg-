import { useState } from 'react'
import { centInEuroTesto, parseEuro } from '../lib/importi'
import { normalizza } from '../lib/testo'
import type { Articolo, Riga } from '../lib/tipi'

export interface RigaForm {
  articoloId?: string // il prodotto del magazzino da cui nasce la riga (serve per scalare i materiali della ricetta)
  descrizione: string
  testo: string
  quantita: string
  prezzo: string
}

export const rigaVuota = (): RigaForm => ({ descrizione: '', testo: '', quantita: '1', prezzo: '' })

const vuota = (r: RigaForm) => !r.descrizione.trim() && !r.testo.trim() && !r.prezzo.trim()

/** Converte le righe del form; null se una riga compilata è incompleta o non valida. Le righe vuote si ignorano. */
export function righeDaForm(forms: RigaForm[]): Riga[] | null {
  const out: Riga[] = []
  for (const f of forms) {
    if (vuota(f)) continue
    const prezzo = parseEuro(f.prezzo)
    const quantita = Number(f.quantita)
    if (!f.descrizione.trim() || prezzo === null || !Number.isInteger(quantita) || quantita < 1) return null
    out.push({
      ...(f.articoloId ? { articoloId: f.articoloId } : {}),
      descrizione: f.descrizione.trim(),
      ...(f.testo.trim() ? { testoPersonalizzato: f.testo.trim() } : {}),
      quantita,
      prezzoUnitarioCent: prezzo,
    })
  }
  return out
}

const MAX_SUGGERITI = 8

interface Props {
  righe: RigaForm[]
  onChange: (r: RigaForm[]) => void
  listino: Articolo[]
}

export function RigheEditor({ righe, onChange, listino }: Props) {
  const [ricerca, setRicerca] = useState('')

  const aggiorna = (i: number, patch: Partial<RigaForm>) =>
    onChange(righe.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  /** Un tocco aggiunge il prodotto; se c'è già una riga uguale (senza testo personalizzato) ne aumenta la quantità. */
  function daListino(v: Articolo) {
    const uguale = righe.findIndex(
      (r) => r.articoloId === v.id && parseEuro(r.prezzo) === v.prezzoCent && !r.testo.trim(),
    )
    if (uguale >= 0) {
      const qta = Number(righe[uguale].quantita)
      aggiorna(uguale, { quantita: String(Number.isInteger(qta) && qta >= 1 ? qta + 1 : 1) })
      return
    }
    const nuova: RigaForm = { articoloId: v.id, descrizione: v.nome, testo: '', quantita: '1', prezzo: centInEuroTesto(v.prezzoCent ?? 0) }
    onChange(righe.length === 1 && vuota(righe[0]) ? [nuova] : [...righe, nuova])
  }

  // nel nuovo ordine si propongono solo i Prodotti in uso, venduti a pezzi e con un prezzo (le quantità dell'ordine sono intere);
  // i Materiali restano in magazzino
  const attive = listino.filter((v) => v.attivo && v.tipo === 'prodotto' && v.unita === 'pezzi' && v.prezzoCent !== undefined)
  const q = normalizza(ricerca)
  const corrispondenti = q ? attive.filter((v) => normalizza(v.nome).includes(q)) : attive
  const suggeriti = corrispondenti.slice(0, MAX_SUGGERITI)

  return (
    <div>
      {attive.length > 0 && (
        <section className="scheda" aria-label="Listino">
          <label htmlFor="cerca-listino">Cerca un prodotto</label>
          <input id="cerca-listino" autoComplete="off" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
          <div style={{ marginTop: '.5rem' }}>
            {suggeriti.map((v) => (
              <button
                key={v.id}
                type="button"
                className="secondario"
                style={{ margin: '0 .4rem .4rem 0' }}
                onClick={() => daListino(v)}
              >
                + {v.nome} · {centInEuroTesto(v.prezzoCent ?? 0)} €
              </button>
            ))}
          </div>
          {suggeriti.length === 0 && <p>Nessun prodotto corrisponde.</p>}
          {corrispondenti.length > suggeriti.length && (
            <p>Mostrati {suggeriti.length} di {corrispondenti.length}: scrivi per cercare.</p>
          )}
        </section>
      )}
      {righe.map((r, i) => (
        <div className="scheda" key={i}>
          <label htmlFor={`desc-${i}`}>Prodotto {i + 1}</label>
          <input id={`desc-${i}`} value={r.descrizione} onChange={(e) => aggiorna(i, { descrizione: e.target.value })} />
          <label htmlFor={`testo-${i}`}>Testo personalizzato {i + 1}</label>
          <input id={`testo-${i}`} value={r.testo} onChange={(e) => aggiorna(i, { testo: e.target.value })} />
          <div className="griglia2">
            <div>
              <label htmlFor={`qta-${i}`}>Quantità {i + 1}</label>
              <input id={`qta-${i}`} inputMode="numeric" value={r.quantita} onChange={(e) => aggiorna(i, { quantita: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`prz-${i}`}>Prezzo unitario {i + 1} (€)</label>
              <input id={`prz-${i}`} inputMode="decimal" value={r.prezzo} onChange={(e) => aggiorna(i, { prezzo: e.target.value })} />
            </div>
          </div>
          {righe.length > 1 && (
            <p><button type="button" className="secondario" onClick={() => onChange(righe.filter((_, k) => k !== i))}>Togli riga {i + 1}</button></p>
          )}
        </div>
      ))}
      <button type="button" className="secondario" onClick={() => onChange([...righe, rigaVuota()])}>+ Aggiungi riga</button>
    </div>
  )
}
