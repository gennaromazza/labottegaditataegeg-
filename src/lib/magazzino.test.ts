import { calcolaMovimento, daArticolo, filtraArticoli, testoMovimento } from './magazzino'
import type { Articolo, Movimento } from './tipi'

describe('daArticolo: i vecchi voci del listino restano valide', () => {
  it('una voce del listino senza campi nuovi diventa un Prodotto in pezzi con giacenza 0', () => {
    expect(daArticolo('x', { nome: 'Candela grande', prezzoCent: 800, attivo: true })).toEqual({
      id: 'x',
      nome: 'Candela grande',
      tipo: 'prodotto',
      unita: 'pezzi',
      giacenza: 0,
      prezzoCent: 800,
      attivo: true,
    })
  })
  it('un materiale in chili con la sua giacenza', () => {
    const a = daArticolo('y', { nome: 'Cera', tipo: 'materiale', unita: 'kg', giacenza: 2500, attivo: true })
    expect(a).toMatchObject({ tipo: 'materiale', unita: 'kg', giacenza: 2500 })
    expect(a.prezzoCent).toBeUndefined()
  })
  it('dati sporchi non rompono nulla: unità sconosciuta, giacenza negativa o decimale, attivo assente', () => {
    const a = daArticolo('z', { nome: 'X', unita: 'litri?', giacenza: -5 })
    expect(a).toMatchObject({ unita: 'pezzi', giacenza: 0, attivo: true })
    expect(daArticolo('w', { nome: 'Y', giacenza: 1.5 }).giacenza).toBe(0)
  })
  it('la ricetta salvata si legge; ingredienti non validi vengono scartati', () => {
    const a = daArticolo('p', {
      nome: 'Segnaposto',
      ricetta: [
        { articoloId: 'fil', quantita: 18 },
        { articoloId: 'x', quantita: 0 },
        { articoloId: 'y', quantita: 1.5 },
        { articoloId: 5, quantita: 3 },
        null,
        { articoloId: 'ane', quantita: 1 },
      ],
    })
    expect(a.ricetta).toEqual([
      { articoloId: 'fil', quantita: 18 },
      { articoloId: 'ane', quantita: 1 },
    ])
  })
  it('una ricetta vuota o non valida è come nessuna ricetta', () => {
    expect(daArticolo('p', { nome: 'A', ricetta: [] }).ricetta).toBeUndefined()
    expect(daArticolo('p', { nome: 'A', ricetta: 'boh' }).ricetta).toBeUndefined()
    expect('ricetta' in daArticolo('p', { nome: 'A' })).toBe(false)
  })
  it('attivo false resta false', () => expect(daArticolo('v', { nome: 'Z', attivo: false }).attivo).toBe(false))
})

describe('calcolaMovimento', () => {
  it('carico: somma', () => {
    expect(calcolaMovimento(500, 'carico', 2000, 'kg')).toEqual({ ok: true, nuova: 2500, delta: 2000 })
  })
  it('scarico: sottrae e il delta è negativo', () => {
    expect(calcolaMovimento(2500, 'scarico', 20, 'kg')).toEqual({ ok: true, nuova: 2480, delta: -20 })
  })
  it('scarico di tutto quello che c\'è: va a zero, non è un errore', () => {
    expect(calcolaMovimento(300, 'scarico', 300, 'g')).toEqual({ ok: true, nuova: 0, delta: -300 })
  })
  it('scarico oltre la giacenza: rifiutato, dice quanto ne resta', () => {
    const r = calcolaMovimento(1500, 'scarico', 2000, 'kg')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('Non basta: ne restano 1,5 kg.')
  })
  it('scarico da un articolo a zero', () => {
    const r = calcolaMovimento(0, 'scarico', 1, 'pezzi')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('Non basta: ne restano 0 pezzi.')
  })
  it('carico e scarico di zero non hanno senso', () => {
    for (const t of ['carico', 'scarico'] as const) {
      const r = calcolaMovimento(10, t, 0, 'pezzi')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toMatch(/maggiore di zero/)
    }
  })
  it('correzione: imposta il valore esatto e calcola la differenza', () => {
    expect(calcolaMovimento(5000, 'rettifica', 3000, 'kg')).toEqual({ ok: true, nuova: 3000, delta: -2000 })
    expect(calcolaMovimento(5000, 'rettifica', 8000, 'kg')).toEqual({ ok: true, nuova: 8000, delta: 3000 })
  })
  it('correzione a zero è valida (articolo finito)', () => {
    expect(calcolaMovimento(5, 'rettifica', 0, 'pezzi')).toEqual({ ok: true, nuova: 0, delta: -5 })
  })
  it('correzione al valore già presente: avvisa', () => {
    const r = calcolaMovimento(5, 'rettifica', 5, 'pezzi')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/già questa/)
  })
  it('quantità non intere o negative vengono rifiutate (protezione contro dati sporchi)', () => {
    expect(calcolaMovimento(10, 'carico', 1.5, 'pezzi').ok).toBe(false)
    expect(calcolaMovimento(10, 'carico', -3, 'pezzi').ok).toBe(false)
    expect(calcolaMovimento(10, 'rettifica', -1, 'pezzi').ok).toBe(false)
    expect(calcolaMovimento(10, 'carico', Number.NaN, 'pezzi').ok).toBe(false)
  })
  it('la giacenza non diventa mai negativa', () => {
    for (const q of [0, 1, 7, 10, 11, 1000]) {
      const r = calcolaMovimento(10, 'scarico', q, 'pezzi')
      if (r.ok) expect(r.nuova).toBeGreaterThanOrEqual(0)
    }
  })
})

const mov = (extra: Partial<Movimento>): Movimento => ({
  id: 'm1',
  articoloId: 'a1',
  articoloNome: 'Cera di soia',
  tipo: 'carico',
  delta: 2000,
  giacenzaDopo: 2500,
  unita: 'kg',
  data: '2026-11-23',
  creatoIl: '2026-11-23T10:00:00.000Z',
  ...extra,
})

describe('testoMovimento', () => {
  it('carico', () => expect(testoMovimento(mov({}))).toBe('Carico +2 kg → ora 2,5 kg'))
  it('scarico', () => expect(testoMovimento(mov({ tipo: 'scarico', delta: -250, giacenzaDopo: 2250 }))).toBe('Scarico -250 g → ora 2,25 kg'))
  it('correzione', () => expect(testoMovimento(mov({ tipo: 'rettifica', delta: -500, giacenzaDopo: 2000 }))).toBe('Correzione -500 g → ora 2 kg'))
  it('pezzi al singolare', () => expect(testoMovimento(mov({ unita: 'pezzi', delta: 1, giacenzaDopo: 1 }))).toBe('Carico +1 pezzo → ora 1 pezzo'))
})

const art = (id: string, nome: string, tipo: Articolo['tipo'], attivo = true): Articolo => ({
  id,
  nome,
  tipo,
  unita: 'pezzi',
  giacenza: 0,
  attivo,
})

describe('filtraArticoli', () => {
  const lista = [art('1', 'Cera di soia', 'materiale'), art('2', 'Candela grande', 'prodotto'), art('3', 'Stoppino', 'materiale', false), art('4', 'Più fiori', 'prodotto')]
  it('senza filtri restituisce tutto', () => expect(filtraArticoli(lista, '', '')).toHaveLength(4))
  it('per tipo', () => {
    expect(filtraArticoli(lista, '', 'materiale').map((a) => a.id)).toEqual(['1', '3'])
    expect(filtraArticoli(lista, '', 'prodotto').map((a) => a.id)).toEqual(['2', '4'])
  })
  it('per testo, senza badare a maiuscole e accenti', () => {
    expect(filtraArticoli(lista, 'CERA', '').map((a) => a.id)).toEqual(['1'])
    expect(filtraArticoli(lista, 'piu', '').map((a) => a.id)).toEqual(['4'])
  })
  it('testo e tipo insieme', () => {
    expect(filtraArticoli(lista, 'fior', 'prodotto').map((a) => a.id)).toEqual(['4'])
    expect(filtraArticoli(lista, 'fior', 'materiale')).toEqual([])
  })
  it('nessun risultato', () => expect(filtraArticoli(lista, 'zzz', '')).toEqual([]))
})
