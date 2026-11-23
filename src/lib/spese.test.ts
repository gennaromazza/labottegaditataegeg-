import { speseFiltrate, spesePerCategoria, totaleIncassi, totaleSpese, utileCent } from './calcoli'
import { ordineDiProva } from './fixture'
import type { Spesa } from './tipi'

const spese: Spesa[] = [
  { id: 's1', descrizione: 'Corriere', importoCent: 590, data: '2026-11-05', categoria: 'Spedizioni' },
  { id: 's2', descrizione: 'Cera', importoCent: 2000, data: '2026-11-10', categoria: 'Materiali' },
  { id: 's3', descrizione: 'Corriere', importoCent: 700, data: '2026-12-01', categoria: 'Spedizioni' },
]

describe('spese', () => {
  it('filtra per periodo (estremi inclusi) e categoria', () => {
    expect(speseFiltrate(spese, '2026-11-01', '2026-11-30').map((s) => s.id)).toEqual(['s1', 's2'])
    expect(speseFiltrate(spese, '2026-11-05', '2026-11-05').map((s) => s.id)).toEqual(['s1'])
    expect(speseFiltrate(spese, '2026-11-01', '2026-12-31', 'Spedizioni').map((s) => s.id)).toEqual(['s1', 's3'])
  })
  it('totali del periodo e delle spedizioni', () => {
    expect(totaleSpese(spese, '2026-11-01', '2026-11-30')).toBe(2590)
    expect(totaleSpese(spese, '2026-11-01', '2026-12-31', 'Spedizioni')).toBe(1290)
    expect(totaleSpese([], '2026-11-01', '2026-11-30')).toBe(0)
  })
  it('per categoria', () => {
    expect(spesePerCategoria(spese, '2026-11-01', '2026-12-31')).toEqual(
      expect.arrayContaining([
        { chiave: 'Spedizioni', totaleCent: 1290 },
        { chiave: 'Materiali', totaleCent: 2000 },
      ]),
    )
  })
})

describe('utile', () => {
  const o = ordineDiProva({
    pagamenti: [
      { importoCent: 5000, data: '2026-11-05' },
      { importoCent: 1000, data: '2026-12-02' },
    ],
  })
  it('incassi del periodo', () => expect(totaleIncassi([o], '2026-11-01', '2026-11-30')).toBe(5000))
  it('utile = incassi - spese, anche negativo', () => {
    expect(utileCent([o], spese, '2026-11-01', '2026-11-30')).toBe(5000 - 2590)
    expect(utileCent([], spese, '2026-11-01', '2026-11-30')).toBe(-2590)
  })
})
