import { daRimborsare, incassiPer, incassiPerMese, residuoCent, statoPagamento, totaleCent, versatoCent } from './calcoli'
import { ordineDiProva } from './fixture'

describe('totaleCent', () => {
  it('somma quantità per prezzo', () => {
    expect(totaleCent(ordineDiProva().righe)).toBe(1750)
  })
  it('lista vuota = 0', () => {
    expect(totaleCent([])).toBe(0)
  })
})

describe('statoPagamento', () => {
  const pag = (importoCent: number) => ({ importoCent, data: '2026-11-05' })
  it('non pagato', () => expect(statoPagamento(ordineDiProva())).toBe('non_pagato'))
  it('acconto', () => expect(statoPagamento(ordineDiProva({ pagamenti: [pag(500)] }))).toBe('acconto'))
  it('saldato con più acconti', () =>
    expect(statoPagamento(ordineDiProva({ pagamenti: [pag(500), pag(1250)] }))).toBe('saldato'))
  it('eccedente', () => expect(statoPagamento(ordineDiProva({ pagamenti: [pag(2000)] }))).toBe('eccedente'))
  it('totale 0 senza pagamenti = saldato', () =>
    expect(statoPagamento(ordineDiProva({ righe: [] }))).toBe('saldato'))
  it('residuo e versato', () => {
    const o = ordineDiProva({ pagamenti: [pag(500), pag(300)] })
    expect(versatoCent(o)).toBe(800)
    expect(residuoCent(o)).toBe(950)
    expect(residuoCent(ordineDiProva({ pagamenti: [pag(2000)] }))).toBe(-250)
  })
})

describe('incassi', () => {
  const o = ordineDiProva({
    pagamenti: [
      { importoCent: 500, data: '2026-11-05', metodo: 'contanti' },
      { importoCent: 300, data: '2026-11-20' },
      { importoCent: 100, data: '2026-12-01', metodo: 'contanti' },
    ],
  })
  it('per mese, ordinato', () => {
    expect(incassiPerMese([o])).toEqual([
      { mese: '2026-11', totaleCent: 800 },
      { mese: '2026-12', totaleCent: 100 },
    ])
  })
  it('per metodo, senza metodo = non indicato, periodo inclusivo', () => {
    const r = incassiPer([o], 'metodo', '2026-11-01', '2026-11-30')
    expect(r).toEqual(
      expect.arrayContaining([
        { chiave: 'contanti', totaleCent: 500 },
        { chiave: 'non indicato', totaleCent: 300 },
      ]),
    )
    expect(r).toHaveLength(2)
  })
  it('per canale filtra gli estremi', () => {
    expect(incassiPer([o], 'canale', '2026-11-05', '2026-11-05')).toEqual([{ chiave: 'WhatsApp', totaleCent: 500 }])
  })
  it('gli annullati restano negli incassi', () => {
    const a = { ...o, stato: 'annullato' as const }
    expect(incassiPerMese([a])[0].totaleCent).toBe(800)
  })
})

describe('daRimborsare', () => {
  it('annullato con versato', () =>
    expect(daRimborsare(ordineDiProva({ stato: 'annullato', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] }))).toBe(true))
  it('annullato senza versato', () => expect(daRimborsare(ordineDiProva({ stato: 'annullato' }))).toBe(false))
})
