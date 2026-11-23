import type { VoceListino } from '../data/listino'
import { centInEuroTesto, parseEuro } from '../lib/importi'
import type { Riga } from '../lib/tipi'

export interface RigaForm {
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
      descrizione: f.descrizione.trim(),
      ...(f.testo.trim() ? { testoPersonalizzato: f.testo.trim() } : {}),
      quantita,
      prezzoUnitarioCent: prezzo,
    })
  }
  return out
}

interface Props {
  righe: RigaForm[]
  onChange: (r: RigaForm[]) => void
  listino: VoceListino[]
}

export function RigheEditor({ righe, onChange, listino }: Props) {
  const aggiorna = (i: number, patch: Partial<RigaForm>) =>
    onChange(righe.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  function daListino(id: string) {
    const v = listino.find((x) => x.id === id)
    if (!v) return
    const nuova: RigaForm = { descrizione: v.nome, testo: '', quantita: '1', prezzo: centInEuroTesto(v.prezzoCent) }
    onChange(righe.length === 1 && vuota(righe[0]) ? [nuova] : [...righe, nuova])
  }

  const attive = listino.filter((v) => v.attivo)

  return (
    <div>
      {attive.length > 0 && (
        <>
          <label htmlFor="da-listino">Aggiungi dal listino</label>
          <select id="da-listino" value="" onChange={(e) => daListino(e.target.value)}>
            <option value="">Scegli un prodotto…</option>
            {attive.map((v) => (
              <option key={v.id} value={v.id}>{v.nome} – {centInEuroTesto(v.prezzoCent)} €</option>
            ))}
          </select>
        </>
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
