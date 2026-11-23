import type { Ordine, Riga } from './tipi'

export type StatoPagamento = 'non_pagato' | 'acconto' | 'saldato' | 'eccedente'

export function totaleCent(righe: Riga[]): number {
  return righe.reduce((s, r) => s + r.quantita * r.prezzoUnitarioCent, 0)
}

export function versatoCent(o: Ordine): number {
  return o.pagamenti.reduce((s, p) => s + p.importoCent, 0)
}

export function residuoCent(o: Ordine): number {
  return totaleCent(o.righe) - versatoCent(o)
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

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
export function formatEuro(cent: number): string {
  return euro.format(cent / 100)
}

export function formatData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
