import { compatibili, DIMENSIONE, formatQuantita, inBase, parseQuantita, UNITA, unitaCambiabile, unitaCompatibili, unitaPerRicetta } from './unita'

describe('parseQuantita (testo → numero intero in unità base)', () => {
  it.each([
    ['20', 'g', 20],
    ['1,25', 'kg', 1250],
    ['1.25', 'kg', 1250],
    ['0,5', 'kg', 500],
    ['2', 'l', 2000],
    ['0,250', 'l', 250],
    ['3', 'pezzi', 3],
    ['1,5', 'm', 150],
    ['40', 'cm', 40],
    ['500', 'ml', 500],
    [' 7 ', 'pezzi', 7],
  ] as const)('%s %s → %i', (t, u, atteso) => expect(parseQuantita(t, u)).toBe(atteso))

  it.each([
    ['', 'g'],
    ['abc', 'g'],
    ['-5', 'g'],
    ['1,5', 'pezzi'], // niente mezzi pezzi
    ['0,5', 'g'], // niente decimali sui grammi
    ['1,2345', 'kg'], // oltre i millesimi
    ['1,5,2', 'kg'],
  ] as const)('"%s" in %s non è valido', (t, u) => expect(parseQuantita(t, u)).toBeNull())

  it('0 è valido (serve per "imposta giacenza a zero")', () => expect(parseQuantita('0', 'pezzi')).toBe(0))

  it('non sbaglia con i decimali che in virgola mobile danno problemi', () => {
    expect(parseQuantita('1,005', 'kg')).toBe(1005)
    expect(parseQuantita('0,29', 'm')).toBe(29)
    expect(parseQuantita('4,35', 'm')).toBe(435)
  })
})

describe('formatQuantita (unità base → testo per l\'utente)', () => {
  it.each([
    [1250, 'kg', '1,25 kg'],
    [20, 'g', '20 g'],
    [2000, 'kg', '2 kg'],
    [1500, 'l', '1,5 l'],
    [150, 'm', '1,5 m'],
    [0, 'pezzi', '0 pezzi'],
    [1, 'pezzi', '1 pezzo'],
    [3, 'pezzi', '3 pezzi'],
    [1234567, 'g', '1.234.567 g'],
  ] as const)('%i %s → %s', (base, u, atteso) => expect(formatQuantita(base, u)).toBe(atteso))

  it('un valore negativo (per i movimenti di scarico) mantiene il segno', () => {
    expect(formatQuantita(-250, 'kg')).toBe('-0,25 kg')
  })
})

describe('famiglie di unità', () => {
  it('ogni unità ha una famiglia', () => {
    for (const u of UNITA) expect(DIMENSIONE[u]).toBeTruthy()
  })
  it('compatibili solo dentro la stessa famiglia', () => {
    expect(compatibili('g', 'kg')).toBe(true)
    expect(compatibili('ml', 'l')).toBe(true)
    expect(compatibili('cm', 'm')).toBe(true)
    expect(compatibili('g', 'ml')).toBe(false)
    expect(compatibili('pezzi', 'g')).toBe(false)
  })
  it('inBase serve alle ricette: 20 g su una scorta in kg', () => {
    expect(inBase(20, 'g')).toBe(20)
    expect(inBase(2, 'kg')).toBe(2000)
  })
  it('cambio di unità: libero nella stessa famiglia, tra famiglie solo a giacenza zero', () => {
    expect(unitaCambiabile('g', 'kg', 5000)).toBe(true)
    expect(unitaCambiabile('pezzi', 'g', 12)).toBe(false)
    expect(unitaCambiabile('pezzi', 'g', 0)).toBe(true)
  })
})

describe('unità per le ricette', () => {
  it('per un materiale in chili si può scrivere in grammi o chili', () => expect(unitaCompatibili('kg')).toEqual(['g', 'kg']))
  it('per i pezzi solo pezzi', () => expect(unitaCompatibili('pezzi')).toEqual(['pezzi']))
  it('litri e metri', () => {
    expect(unitaCompatibili('l')).toEqual(['ml', 'l'])
    expect(unitaCompatibili('m')).toEqual(['cm', 'm'])
  })
  it("di solito si scrive nell'unità piccola", () => {
    expect(unitaPerRicetta('kg')).toBe('g')
    expect(unitaPerRicetta('l')).toBe('ml')
    expect(unitaPerRicetta('m')).toBe('cm')
    expect(unitaPerRicetta('pezzi')).toBe('pezzi')
    expect(unitaPerRicetta('g')).toBe('g')
  })
  it('20 g su una scorta in chili è 20 in unità base', () => {
    expect(parseQuantita('20', unitaPerRicetta('kg'))).toBe(20)
    expect(parseQuantita('0,5', 'kg')).toBe(500)
  })
})
