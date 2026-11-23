import { normalizza } from './testo'
import { ETICHETTE_MOVIMENTO, type Articolo, type Movimento, type TipoArticolo, type TipoMovimento } from './tipi'
import { formatQuantita, UNITA, type Unita } from './unita'

/** Gli articoli creati quando c'era solo il listino non hanno tipo, unità e giacenza: si leggono come Prodotti in pezzi, giacenza 0. */
export function daArticolo(id: string, d: Record<string, unknown>): Articolo {
  return {
    id,
    nome: String(d.nome ?? ''),
    tipo: d.tipo === 'materiale' ? 'materiale' : 'prodotto',
    unita: UNITA.includes(d.unita as Unita) ? (d.unita as Unita) : 'pezzi',
    giacenza: Number.isInteger(d.giacenza) && (d.giacenza as number) >= 0 ? (d.giacenza as number) : 0,
    ...(typeof d.prezzoCent === 'number' ? { prezzoCent: d.prezzoCent } : {}),
    attivo: d.attivo !== false,
    ...(typeof d.note === 'string' && d.note ? { note: d.note } : {}),
  }
}

export type EsitoMovimento = { ok: true; nuova: number; delta: number } | { ok: false; motivo: string }

/**
 * Calcola la nuova giacenza (in unità base) per un carico, uno scarico o una correzione.
 * La giacenza non diventa mai negativa: uno scarico oltre quello che c'è viene rifiutato.
 */
export function calcolaMovimento(giacenza: number, tipo: TipoMovimento, quantita: number, unita: Unita): EsitoMovimento {
  if (!Number.isInteger(quantita) || quantita < 0) return { ok: false, motivo: 'La quantità non è valida.' }

  if (tipo === 'rettifica') {
    if (quantita === giacenza) return { ok: false, motivo: 'La giacenza è già questa.' }
    return { ok: true, nuova: quantita, delta: quantita - giacenza }
  }

  if (quantita === 0) return { ok: false, motivo: 'Scrivi una quantità maggiore di zero.' }
  if (tipo === 'carico') return { ok: true, nuova: giacenza + quantita, delta: quantita }
  if (quantita > giacenza) return { ok: false, motivo: `Non basta: ne restano ${formatQuantita(giacenza, unita)}.` }
  return { ok: true, nuova: giacenza - quantita, delta: -quantita }
}

/** Riga dello storico: "Carico +2 kg → ora 2,5 kg". */
export function testoMovimento(m: Movimento): string {
  const variazione = m.delta < 0 ? formatQuantita(m.delta, m.unita) : `+${formatQuantita(m.delta, m.unita)}`
  return `${ETICHETTE_MOVIMENTO[m.tipo]} ${variazione} → ora ${formatQuantita(m.giacenzaDopo, m.unita)}`
}

/** Cerca per nome (senza badare a maiuscole e accenti) e, se serve, per tipo. */
export function filtraArticoli(articoli: Articolo[], ricerca: string, tipo: TipoArticolo | ''): Articolo[] {
  const q = normalizza(ricerca)
  return articoli.filter((a) => (!tipo || a.tipo === tipo) && (!q || normalizza(a.nome).includes(q)))
}
