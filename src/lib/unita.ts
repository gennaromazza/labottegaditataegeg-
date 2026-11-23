/**
 * Unità di misura del magazzino.
 * La giacenza si salva sempre in unità BASE intera (g, ml, cm, pezzi): 1,25 kg = 1250 g.
 * Così non ci sono errori di virgola mobile e kg↔g, l↔ml sono solo una questione di visualizzazione.
 */
export type Unita = 'pezzi' | 'g' | 'kg' | 'ml' | 'l' | 'cm' | 'm'
export type Famiglia = 'conteggio' | 'massa' | 'volume' | 'lunghezza'

export const UNITA: Unita[] = ['pezzi', 'g', 'kg', 'ml', 'l', 'cm', 'm']

export const ETICHETTE_UNITA: Record<Unita, string> = {
  pezzi: 'Pezzi',
  g: 'Grammi (g)',
  kg: 'Chili (kg)',
  ml: 'Millilitri (ml)',
  l: 'Litri (l)',
  cm: 'Centimetri (cm)',
  m: 'Metri (m)',
}

export const DIMENSIONE: Record<Unita, Famiglia> = {
  pezzi: 'conteggio',
  g: 'massa',
  kg: 'massa',
  ml: 'volume',
  l: 'volume',
  cm: 'lunghezza',
  m: 'lunghezza',
}

/** Quante unità base contiene un'unità. */
const FATTORE: Record<Unita, number> = { pezzi: 1, g: 1, kg: 1000, ml: 1, l: 1000, cm: 1, m: 100 }
/** Quante cifre decimali ha senso scrivere (coincide con le cifre del fattore). */
const DECIMALI: Record<Unita, number> = { pezzi: 0, g: 0, kg: 3, ml: 0, l: 3, cm: 0, m: 2 }

export const compatibili = (a: Unita, b: Unita): boolean => DIMENSIONE[a] === DIMENSIONE[b]

/** Cambiare unità è libero dentro la stessa famiglia (g↔kg); tra famiglie diverse solo se la giacenza è zero. */
export const unitaCambiabile = (da: Unita, a: Unita, giacenzaBase: number): boolean => compatibili(da, a) || giacenzaBase === 0

/** Un valore in una certa unità → unità base (per le ricette: 20 g su una scorta in kg). */
export const inBase = (valore: number, unita: Unita): number => Math.round(valore * FATTORE[unita])

/**
 * "1,25" in kg → 1250. Accetta virgola o punto. Restituisce null se non è un numero valido,
 * se è negativo o se ha più decimali di quelli sensati per l'unità (niente mezzi pezzi, niente 0,5 g).
 */
export function parseQuantita(testo: string, unita: Unita): number | null {
  const t = testo.trim().replace(/\s/g, '').replace(',', '.')
  const d = DECIMALI[unita]
  const modello = d === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${d}})?$`)
  if (!modello.test(t)) return null
  const [intero, frazione = ''] = t.split('.')
  // aritmetica sulle cifre, non sui decimali: nessun errore di arrotondamento
  return Number(intero) * FATTORE[unita] + (d === 0 ? 0 : Number(frazione.padEnd(d, '0')))
}

const migliaia = new Intl.NumberFormat('it-IT')

/** 1250 in kg → "1,25 kg"; 1 pezzo → "1 pezzo". I valori negativi (scarichi) mantengono il segno. */
export function formatQuantita(base: number, unita: Unita): string {
  const negativo = base < 0
  const assoluto = Math.abs(base)
  const f = FATTORE[unita]
  const d = DECIMALI[unita]
  const intero = Math.floor(assoluto / f)
  const resto = assoluto % f
  let numero = migliaia.format(intero)
  if (d > 0 && resto > 0) numero += `,${String(resto).padStart(d, '0').replace(/0+$/, '')}`
  const etichetta = unita === 'pezzi' ? (assoluto === 1 ? 'pezzo' : 'pezzi') : unita
  return `${negativo ? '-' : ''}${numero} ${etichetta}`
}
