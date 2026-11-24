import { fabbisogno, pianoModifica, righeCambiate } from './ricette'
import type { Articolo, Riga, ScaricoMagazzino } from './tipi'

const mat = (id: string, nome: string, unita: Articolo['unita'], giacenza: number): Articolo => ({ id, nome, tipo: 'materiale', unita, giacenza, attivo: true })
const filamento = mat('fil', 'Filamento PLA', 'kg', 4820) // dopo uno scarico di 180 g
const anello = mat('ane', 'Anello', 'pezzi', 90) // dopo uno scarico di 10
const segnaposto: Articolo = {
  id: 'seg',
  nome: 'Segnaposto',
  tipo: 'prodotto',
  unita: 'pezzi',
  giacenza: 0,
  prezzoCent: 250,
  attivo: true,
  ricetta: [
    { articoloId: 'fil', quantita: 18 },
    { articoloId: 'ane', quantita: 1 },
  ],
}
const rivendita: Articolo = { id: 'riv', nome: 'Rivendita', tipo: 'prodotto', unita: 'pezzi', giacenza: 3, prezzoCent: 100, attivo: true }
const articoli = [filamento, anello, segnaposto, rivendita]

// scarico fatto per 10 segnaposto: 180 g di filamento e 10 anelli
const scarico: ScaricoMagazzino = {
  data: '2026-11-20',
  voci: [
    { articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 180, scalata: 180 },
    { articoloId: 'ane', nome: 'Anello', unita: 'pezzi', necessaria: 10, scalata: 10 },
  ],
}

const riga = (articoloId: string | undefined, quantita: number, prezzoUnitarioCent = 250, descrizione = 'x'): Riga => ({
  ...(articoloId ? { articoloId } : {}),
  descrizione,
  quantita,
  prezzoUnitarioCent,
})

const piano = (righe: Riga[], opz: { scarico?: ScaricoMagazzino; procedi?: boolean; magazzino?: Articolo[] } = {}) => {
  const lista = opz.magazzino ?? articoli
  return pianoModifica(opz.scarico ?? scarico, fabbisogno(righe, lista).voci, lista, opz.procedi ?? false)
}
const variazione = (p: ReturnType<typeof piano>, id: string) => p.variazioni.find((v) => v.articoloId === id)?.variazione

describe('righeCambiate: serve ricalcolare il magazzino solo se cambiano prodotti o quantità', () => {
  it('uguali', () => expect(righeCambiate([riga('seg', 10)], [riga('seg', 10)])).toBe(false))
  it('cambiare prezzo, testo o descrizione non tocca il magazzino', () => {
    expect(righeCambiate([riga('seg', 10, 250, 'a')], [riga('seg', 10, 999, 'b')])).toBe(false)
  })
  it('cambia la quantità', () => expect(righeCambiate([riga('seg', 10)], [riga('seg', 12)])).toBe(true))
  it('cambia il prodotto', () => expect(righeCambiate([riga('seg', 10)], [riga('riv', 10)])).toBe(true))
  it('una riga in più o in meno', () => {
    expect(righeCambiate([riga('seg', 10)], [riga('seg', 10), riga('riv', 1)])).toBe(true)
    expect(righeCambiate([riga('seg', 10), riga('riv', 1)], [riga('seg', 10)])).toBe(true)
  })
  it('righe scritte a mano (senza prodotto) non contano', () => {
    expect(righeCambiate([riga('seg', 10), riga(undefined, 5)], [riga('seg', 10), riga(undefined, 99)])).toBe(false)
  })
  it('le stesse righe in un altro ordine non cambiano nulla', () => {
    expect(righeCambiate([riga('seg', 10), riga('riv', 1)], [riga('riv', 1), riga('seg', 10)])).toBe(false)
  })
})

describe('pianoModifica: la differenza tra quanto era stato scalato e quanto serve ora', () => {
  it('più pezzi: 10 → 20 segnaposto, si scalano altri 180 g e 10 anelli', () => {
    const p = piano([riga('seg', 20)])
    expect(p.ok).toBe(true)
    expect(variazione(p, 'fil')).toBe(-180) // la giacenza scende di 180
    expect(variazione(p, 'ane')).toBe(-10)
    expect(p.voci).toEqual(
      expect.arrayContaining([
        { articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 360, scalata: 360 },
        { articoloId: 'ane', nome: 'Anello', unita: 'pezzi', necessaria: 20, scalata: 20 },
      ]),
    )
  })

  it('meno pezzi: 10 → 4, tornano in magazzino 108 g e 6 anelli', () => {
    const p = piano([riga('seg', 4)])
    expect(p.ok).toBe(true)
    expect(variazione(p, 'fil')).toBe(108)
    expect(variazione(p, 'ane')).toBe(6)
    expect(p.voci.find((v) => v.articoloId === 'fil')).toMatchObject({ necessaria: 72, scalata: 72 })
  })

  it('stesse quantità: nessuna variazione', () => {
    const p = piano([riga('seg', 10)])
    expect(p.ok).toBe(true)
    expect(p.variazioni).toEqual([])
  })

  it('si sostituisce il prodotto con uno senza ricetta: tutto torna in magazzino e non resta nessuna voce', () => {
    const p = piano([riga('riv', 2)])
    expect(variazione(p, 'fil')).toBe(180)
    expect(variazione(p, 'ane')).toBe(10)
    expect(p.voci).toEqual([])
  })

  it('un prodotto nuovo con altri materiali: quelli vecchi tornano, i nuovi si scalano', () => {
    const cera = mat('cer', 'Cera', 'kg', 5000)
    const candela: Articolo = { ...segnaposto, id: 'can', nome: 'Candela', ricetta: [{ articoloId: 'cer', quantita: 200 }] }
    const lista = [filamento, anello, cera, segnaposto, candela]
    const p = piano([riga('can', 3)], { magazzino: lista })
    expect(variazione(p, 'fil')).toBe(180)
    expect(variazione(p, 'ane')).toBe(10)
    expect(variazione(p, 'cer')).toBe(-600)
  })

  describe('se non bastano', () => {
    const scarso = [{ ...filamento, giacenza: 100 }, anello, segnaposto] // 100 g in magazzino, 180 già scalati: ne restano disponibili 280
    it('"servono 400, ne hai 280": si ferma e dice cosa manca', () => {
      const p = piano([riga('seg', 400 / 18 > 22 ? 23 : 22)], { magazzino: scarso }) // 23 × 18 = 414 g
      expect(p.ok).toBe(false)
      expect(p.mancanti).toHaveLength(1)
      expect(p.mancanti[0]).toMatchObject({ articoloId: 'fil', necessaria: 414, disponibile: 280, mancante: 134 })
    })
    it('"procedi comunque" scala quanto c\'è: tutto il disponibile, mai sotto zero', () => {
      const p = piano([riga('seg', 23)], { magazzino: scarso, procedi: true })
      expect(p.ok).toBe(true)
      expect(variazione(p, 'fil')).toBe(-100) // si porta a zero la giacenza
      expect(p.voci.find((v) => v.articoloId === 'fil')).toMatchObject({ necessaria: 414, scalata: 280 })
    })
    it('i materiali che bastano non sono tra i mancanti', () => {
      const p = piano([riga('seg', 23)], { magazzino: scarso })
      expect(p.mancanti.map((m) => m.articoloId)).toEqual(['fil'])
    })
  })

  it('uno scarico precedente parziale ("procedi comunque") si porta avanti: ora serve di meno, torna quello scalato in più', () => {
    const parziale: ScaricoMagazzino = {
      data: '2026-11-20',
      voci: [{ articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 540, scalata: 300 }],
    }
    const magazzino = [{ ...filamento, giacenza: 0 }, anello, segnaposto]
    const p = piano([riga('seg', 10)], { scarico: parziale, magazzino }) // ora servono 180
    expect(p.ok).toBe(true)
    expect(variazione(p, 'fil')).toBe(120) // 300 scalati, ne bastano 180: tornano 120
    expect(p.voci.find((v) => v.articoloId === 'fil')).toMatchObject({ necessaria: 180, scalata: 180 })
  })

  it('un materiale sparito dal magazzino non rompe nulla', () => {
    const senzaAnelli = [filamento, segnaposto]
    const p = pianoModifica(scarico, fabbisogno([riga('seg', 20)], senzaAnelli).voci, senzaAnelli, false)
    expect(p.ok).toBe(true)
    expect(variazione(p, 'ane')).toBeUndefined() // niente da scrivere su un articolo che non esiste più
    expect(variazione(p, 'fil')).toBe(-180)
  })

  it('senza uno scarico precedente è come uno scarico nuovo', () => {
    const p = pianoModifica(undefined, fabbisogno([riga('seg', 5)], articoli).voci, articoli, false)
    expect(variazione(p, 'fil')).toBe(-90)
    expect(p.voci).toHaveLength(2)
  })

  it('la giacenza finale non è mai negativa', () => {
    for (const q of [1, 5, 10, 30, 80, 300]) {
      const p = piano([riga('seg', q)], { procedi: true })
      for (const v of p.variazioni) {
        const m = articoli.find((a) => a.id === v.articoloId)!
        expect(m.giacenza + v.variazione).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
