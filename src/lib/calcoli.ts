import type { CategoriaSpesa, Ordine, Riga, Spesa } from './tipi'

export type StatoPagamento = 'non_pagato' | 'acconto' | 'saldato' | 'eccedente'

export function totaleCent(righe: Riga[]): number {
  return righe.reduce((s, r) => s + r.quantita * r.prezzoUnitarioCent, 0)
}

/** C'è una riga di spedizione nell'ordine? (0 = gratuita; assente = nessuna riga, come negli ordini vecchi o nei ritiri). */
export function haSpedizione(o: Ordine): boolean {
  const c = o.costoSpedizioneCent
  return typeof c === 'number' && Number.isFinite(c) && c >= 0
}

/** Quanto paga il cliente di spedizione (0 se non c'è o se il valore non è valido). */
export function spedizioneCent(o: Ordine): number {
  return haSpedizione(o) ? (o.costoSpedizioneCent as number) : 0
}

/** Il totale che il cliente deve pagare: prodotti più spedizione. */
export function totaleOrdineCent(o: Ordine): number {
  return totaleCent(o.righe) + spedizioneCent(o)
}

export function versatoCent(o: Ordine): number {
  return o.pagamenti.reduce((s, p) => s + p.importoCent, 0)
}

export function residuoCent(o: Ordine): number {
  return totaleOrdineCent(o) - versatoCent(o)
}

export function statoPagamento(o: Ordine): StatoPagamento {
  const residuo = residuoCent(o)
  if (residuo < 0) return 'eccedente'
  if (residuo === 0) return 'saldato'
  return versatoCent(o) === 0 ? 'non_pagato' : 'acconto'
}

export function daRimborsare(o: Ordine): boolean {
  return o.stato === 'annullato' && versatoCent(o) > 0
}

export function incassiPerMese(ordini: Ordine[]): { mese: string; totaleCent: number }[] {
  const mappa = new Map<string, number>()
  for (const o of ordini) {
    for (const p of o.pagamenti) {
      const mese = p.data.slice(0, 7)
      mappa.set(mese, (mappa.get(mese) ?? 0) + p.importoCent)
    }
  }
  return [...mappa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mese, totale]) => ({ mese, totaleCent: totale }))
}

export function incassiPer(
  ordini: Ordine[],
  chiave: 'canale' | 'metodo',
  da: string,
  a: string,
): { chiave: string; totaleCent: number }[] {
  const mappa = new Map<string, number>()
  for (const o of ordini) {
    for (const p of o.pagamenti) {
      if (p.data < da || p.data > a) continue
      const k = chiave === 'canale' ? o.canale : (p.metodo ?? 'non indicato')
      mappa.set(k, (mappa.get(k) ?? 0) + p.importoCent)
    }
  }
  return [...mappa.entries()].map(([k, totale]) => ({ chiave: k, totaleCent: totale }))
}

export function speseFiltrate(spese: Spesa[], da: string, a: string, categoria?: CategoriaSpesa): Spesa[] {
  return spese.filter((s) => s.data >= da && s.data <= a && (!categoria || s.categoria === categoria))
}

export function totaleSpese(spese: Spesa[], da: string, a: string, categoria?: CategoriaSpesa): number {
  return speseFiltrate(spese, da, a, categoria).reduce((somma, s) => somma + s.importoCent, 0)
}

export function spesePerCategoria(spese: Spesa[], da: string, a: string): { chiave: string; totaleCent: number }[] {
  const mappa = new Map<string, number>()
  for (const s of speseFiltrate(spese, da, a)) mappa.set(s.categoria, (mappa.get(s.categoria) ?? 0) + s.importoCent)
  return [...mappa.entries()].map(([chiave, totaleCent]) => ({ chiave, totaleCent }))
}

export function totaleIncassi(ordini: Ordine[], da: string, a: string): number {
  return incassiPer(ordini, 'canale', da, a).reduce((somma, v) => somma + v.totaleCent, 0)
}

/** Utile del periodo = incassi (per data di pagamento) meno spese (per data della spesa). */
export function utileCent(ordini: Ordine[], spese: Spesa[], da: string, a: string): number {
  return totaleIncassi(ordini, da, a) - totaleSpese(spese, da, a)
}

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
/** Spedizione addebitata ai clienti negli ordini creati nel periodo (esclusi gli annullati). */
export function spedizioniAddebitate(ordini: Ordine[], da: string, a: string): number {
  return ordini
    .filter((o) => o.stato !== 'annullato' && o.creatoIl >= da && o.creatoIl <= a)
    .reduce((somma, o) => somma + spedizioneCent(o), 0)
}

export function formatEuro(cent: number): string {
  return euro.format(cent / 100)
}

export function formatData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
