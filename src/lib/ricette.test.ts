import {
  deveRipristinare,
  fabbisogno,
  ErroreMateriali,
  pezziRealizzabili,
  pianoScarico,
  testoMancante,
  vociDaRipristinare,
  verificaDisponibilita,
} from './ricette'
import type { Articolo, Riga, ScaricoMagazzino } from './tipi'

const mat = (id: string, nome: string, unita: Articolo['unita'], giacenza: number, extra: Partial<Articolo> = {}): Articolo => ({
  id,
  nome,
  tipo: 'materiale',
  unita,
  giacenza,
  attivo: true,
  ...extra,
})

const filamento = mat('fil', 'Filamento PLA', 'kg', 300) // 300 g in magazzino (base), scorta in chili
const anello = mat('ane', 'Anello portachiavi', 'pezzi', 10)
const cera = mat('cer', 'Cera di soia', 'kg', 5000)

const segnaposto: Articolo = {
  id: 'seg',
  nome: 'Segnaposto 3D',
  tipo: 'prodotto',
  unita: 'pezzi',
  giacenza: 0,
  prezzoCent: 250,
  attivo: true,
  ricetta: [
    { articoloId: 'fil', quantita: 18 }, // 18 g
    { articoloId: 'ane', quantita: 1 },
  ],
}
const candela: Articolo = {
  id: 'can',
  nome: 'Candela grande',
  tipo: 'prodotto',
  unita: 'pezzi',
  giacenza: 0,
  prezzoCent: 800,
  attivo: true,
  ricetta: [
    { articoloId: 'cer', quantita: 200 },
    { articoloId: 'ane', quantita: 3 },
  ],
}
const senzaRicetta: Articolo = { id: 'riv', nome: 'Rivendita', tipo: 'prodotto', unita: 'pezzi', giacenza: 5, prezzoCent: 100, attivo: true }
const tutti = [filamento, anello, cera, segnaposto, candela, senzaRicetta]

// magazzino con anelli in abbondanza: così negli scenari sul filamento il solo a mancare è il filamento
const conAnelli = tutti.map((a) => (a.id === 'ane' ? { ...a, giacenza: 100 } : a))

const riga = (articoloId: string | undefined, quantita: number): Riga => ({
  ...(articoloId ? { articoloId } : {}),
  descrizione: 'x',
  quantita,
  prezzoUnitarioCent: 100,
})

describe('fabbisogno', () => {
  it('quantità della riga per quantità della ricetta: 30 segnaposto × 18 g = 540 g', () => {
    const f = fabbisogno([riga('seg', 30)], tutti)
    expect(f.voci).toEqual(
      expect.arrayContaining([
        { articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 540 },
        { articoloId: 'ane', nome: 'Anello portachiavi', unita: 'pezzi', necessaria: 30 },
      ]),
    )
    expect(f.voci).toHaveLength(2)
  })

  it('più righe con lo stesso materiale si sommano', () => {
    const f = fabbisogno([riga('seg', 10), riga('can', 2)], tutti)
    const anelli = f.voci.find((v) => v.articoloId === 'ane')!
    expect(anelli.necessaria).toBe(10 * 1 + 2 * 3)
    expect(f.voci.find((v) => v.articoloId === 'cer')!.necessaria).toBe(400)
  })

  it('le righe scritte a mano o di prodotti senza ricetta non scalano nulla', () => {
    expect(fabbisogno([riga(undefined, 5), riga('riv', 3)], tutti).voci).toEqual([])
  })

  it('un prodotto che non esiste più (id sconosciuto) non rompe nulla', () => {
    expect(fabbisogno([riga('boh', 2)], tutti).voci).toEqual([])
  })

  it('un ingrediente non trovato o che non è un materiale viene segnalato e non scalato', () => {
    const rotto: Articolo = { ...segnaposto, ricetta: [{ articoloId: 'fantasma', quantita: 5 }, { articoloId: 'can', quantita: 1 }] }
    const f = fabbisogno([riga('seg', 2)], [...tutti.filter((a) => a.id !== 'seg'), rotto])
    expect(f.voci).toEqual([])
    expect(f.problemi).toHaveLength(2)
    expect(f.problemi.join(' ')).toMatch(/non trovato|non è un materiale/)
  })

  it('un materiale disattivato si scala lo stesso ma viene segnalato', () => {
    const f = fabbisogno([riga('seg', 1)], tutti.map((a) => (a.id === 'ane' ? { ...a, attivo: false } : a)))
    expect(f.voci.find((v) => v.articoloId === 'ane')?.necessaria).toBe(1)
    expect(f.problemi.join(' ')).toMatch(/disattivato/)
  })

  it('quantità zero o righe vuote: niente fabbisogno', () => {
    expect(fabbisogno([riga('seg', 0)], tutti).voci).toEqual([])
    expect(fabbisogno([], tutti).voci).toEqual([])
  })
})

describe('verificaDisponibilita', () => {
  it('tutto disponibile', () => {
    const v = verificaDisponibilita(fabbisogno([riga('seg', 5)], tutti).voci, tutti)
    expect(v.ok).toBe(true)
    expect(v.mancanti).toEqual([])
  })

  it('30 segnaposto: servono 540 g ma ce ne sono 300 → manca il filamento, gli anelli bastano', () => {
    const v = verificaDisponibilita(fabbisogno([riga('seg', 30)], conAnelli).voci, conAnelli)
    expect(v.ok).toBe(false)
    expect(v.mancanti).toHaveLength(1)
    expect(v.mancanti[0]).toMatchObject({ articoloId: 'fil', necessaria: 540, disponibile: 300, mancante: 240 })
  })

  it('esattamente quanto c\'è: basta', () => {
    expect(verificaDisponibilita([{ articoloId: 'ane', nome: 'A', unita: 'pezzi', necessaria: 10 }], tutti).ok).toBe(true)
  })

  it('un solo pezzo in meno: manca', () => {
    const v = verificaDisponibilita([{ articoloId: 'ane', nome: 'A', unita: 'pezzi', necessaria: 11 }], tutti)
    expect(v.ok).toBe(false)
    expect(v.mancanti[0].mancante).toBe(1)
  })

  it('senza ricette: ok', () => expect(verificaDisponibilita([], tutti).ok).toBe(true))
})

describe('testoMancante', () => {
  it('"Filamento PLA: servono 540 g, ne hai 300 g" (grammi anche se la scorta è in chili)', () => {
    const v = verificaDisponibilita(fabbisogno([riga('seg', 30)], conAnelli).voci, conAnelli)
    expect(testoMancante(v.mancanti[0])).toBe('Filamento PLA: servono 540 g, ne hai 300 g')
  })
  it('pezzi', () => {
    const v = verificaDisponibilita([{ articoloId: 'ane', nome: 'Anello portachiavi', unita: 'pezzi', necessaria: 11 }], tutti)
    expect(testoMancante(v.mancanti[0])).toBe('Anello portachiavi: servono 11 pezzi, ne hai 10 pezzi')
  })
})

describe('pianoScarico', () => {
  it('se basta, scala tutto', () => {
    const p = pianoScarico(fabbisogno([riga('seg', 5)], tutti).voci, tutti)
    expect(p).toEqual(
      expect.arrayContaining([
        { articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 90, scalata: 90 },
        { articoloId: 'ane', nome: 'Anello portachiavi', unita: 'pezzi', necessaria: 5, scalata: 5 },
      ]),
    )
  })

  it('se non basta, scala quanto c\'è e ricorda cosa mancava; la giacenza non va sotto zero', () => {
    const p = pianoScarico(fabbisogno([riga('seg', 30)], conAnelli).voci, conAnelli)
    const fil = p.find((v) => v.articoloId === 'fil')!
    expect(fil).toMatchObject({ necessaria: 540, scalata: 300 })
    expect(fil.necessaria - fil.scalata).toBe(240)
    for (const v of p) {
      const attuale = conAnelli.find((a) => a.id === v.articoloId)!.giacenza
      expect(attuale - v.scalata).toBeGreaterThanOrEqual(0)
    }
  })

  it('un materiale già a zero non genera uno scarico, ma resta nel piano come mancante', () => {
    const p = pianoScarico([{ articoloId: 'ane', nome: 'A', unita: 'pezzi', necessaria: 4 }], [{ ...anello, giacenza: 0 }])
    expect(p).toEqual([{ articoloId: 'ane', nome: 'A', unita: 'pezzi', necessaria: 4, scalata: 0 }])
  })
})

describe('ripristino e transizioni', () => {
  const scarico: ScaricoMagazzino = {
    data: '2026-11-23',
    voci: [
      { articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 540, scalata: 300 },
      { articoloId: 'ane', nome: 'Anello', unita: 'pezzi', necessaria: 0, scalata: 0 },
    ],
  }
  it('si ripristina solo quello che era stato scalato davvero', () => {
    expect(vociDaRipristinare(scarico)).toEqual([scarico.voci[0]])
  })
  it('senza scarico non c\'è nulla da ripristinare', () => expect(vociDaRipristinare(undefined)).toEqual([]))

  it.each([
    ['annullato', true],
    ['in attesa acconto', true],
    ['confermato', true],
    ['in preparazione', false],
    ['pronto', false],
    ['spedito', false],
    ['consegnato', false],
  ] as const)('con i materiali scalati, passare a %s ripristina: %s', (stato, atteso) => {
    expect(deveRipristinare(stato, scarico)).toBe(atteso)
  })
  it.each(['spedito', 'consegnato'] as const)("se l'ordine era già %s la merce è partita: non si ripristina", (prima) => {
    expect(deveRipristinare('annullato', scarico, prima)).toBe(false)
  })
  it.each(['in attesa acconto', 'confermato', 'in preparazione', 'pronto'] as const)("se l'ordine era %s e viene annullato, si ripristina", (prima) => {
    expect(deveRipristinare('annullato', scarico, prima)).toBe(true)
  })
  it('senza materiali scalati non si ripristina mai', () => {
    expect(deveRipristinare('annullato', undefined)).toBe(false)
  })
})

describe('pezziRealizzabili', () => {
  it('quanti pezzi si fanno con il magazzino di oggi: il materiale più scarso decide', () => {
    // filamento 300 g / 18 = 16 ; anelli 10 / 1 = 10 → 10
    expect(pezziRealizzabili(segnaposto, tutti)).toBe(10)
  })
  it('un prodotto senza ricetta non ha un numero', () => expect(pezziRealizzabili(senzaRicetta, tutti)).toBeNull())
  it('con un materiale finito, zero', () => {
    expect(pezziRealizzabili(segnaposto, tutti.map((a) => (a.id === 'ane' ? { ...a, giacenza: 0 } : a)))).toBe(0)
  })
  it('un ingrediente sparito dal magazzino, zero', () => {
    expect(pezziRealizzabili(segnaposto, tutti.filter((a) => a.id !== 'ane'))).toBe(0)
  })
  it('arrotonda per difetto', () => {
    expect(pezziRealizzabili({ ...segnaposto, ricetta: [{ articoloId: 'fil', quantita: 40 }] }, tutti)).toBe(7) // 300/40 = 7,5
  })
})

describe('ErroreMateriali', () => {
  it('porta con sé i materiali mancanti ed è una regola, non un guasto', () => {
    const v = verificaDisponibilita(fabbisogno([riga('seg', 30)], conAnelli).voci, conAnelli)
    const e = new ErroreMateriali(v.mancanti)
    expect(e.mancanti).toHaveLength(1)
    expect(e.message).toMatch(/Filamento PLA/)
    expect(e).toBeInstanceOf(Error)
  })
})
