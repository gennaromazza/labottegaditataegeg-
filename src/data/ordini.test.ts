import { azzera, elenco, inserisci, leggi } from '../test-utils/fakeFirestore'
import { ErroreMateriali } from '../lib/ricette'
import { ErroreRegola } from '../lib/stati'
import { aggiungiPagamento, cambiaStatoOrdine, creaOrdine, eliminaOrdine, rimuoviPagamento } from './ordini'
import { creaArticolo, registraMovimento } from './magazzino'

// Il codice vero di src/data/* gira su un finto Firestore in memoria (src/test-utils/fakeFirestore.ts),
// che fa rispettare le regole delle transazioni: letture prima delle scritture, niente `undefined`, tutto o niente.
vi.mock('firebase/firestore', async () => await import('../test-utils/fakeFirestore'))
vi.mock('../firebase', () => ({ db: {} }))

const pagamento = { importoCent: 500, data: '2026-11-05' }

function magazzino(giacenze: { fil?: number; ane?: number } = {}) {
  inserisci('listino/fil', { nome: 'Filamento PLA', tipo: 'materiale', unita: 'kg', giacenza: giacenze.fil ?? 5000, attivo: true }) // 5 kg = 5000 g
  inserisci('listino/ane', { nome: 'Anello', tipo: 'materiale', unita: 'pezzi', giacenza: giacenze.ane ?? 100, attivo: true })
  inserisci('listino/seg', {
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
  })
  inserisci('listino/sem', { nome: 'Rivendita', tipo: 'prodotto', unita: 'pezzi', giacenza: 4, prezzoCent: 100, attivo: true })
}

function ordine(extra: Record<string, unknown> = {}, id = 'o1') {
  inserisci(`ordini/${id}`, {
    numero: 7,
    clienteId: 'c1',
    clienteNome: 'Maria Rossi',
    canale: 'WhatsApp',
    righe: [{ articoloId: 'seg', descrizione: 'Segnaposto 3D', quantita: 10, prezzoUnitarioCent: 250 }],
    stato: 'confermato',
    creatoIl: '2026-11-01',
    pagamenti: [pagamento],
    ...extra,
  })
}

const giacenza = (id: string) => leggi(`listino/${id}`)!.giacenza as number
const movimenti = (articoloId: string) => elenco('movimenti').filter((m) => m.articoloId === articoloId)

beforeEach(() => {
  azzera()
  magazzino()
})

describe('cambiaStatoOrdine: scarico dei materiali', () => {
  it('passando a "In preparazione" scala i materiali della ricetta: 10 pezzi × 18 g = 180 g, 10 anelli', async () => {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
    expect(giacenza('fil')).toBe(5000 - 180)
    expect(giacenza('ane')).toBe(90)
    const o = leggi('ordini/o1')!
    expect(o.stato).toBe('in preparazione')
    expect(o.scaricoMagazzino).toMatchObject({
      voci: expect.arrayContaining([
        { articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 180, scalata: 180 },
        { articoloId: 'ane', nome: 'Anello', unita: 'pezzi', necessaria: 10, scalata: 10 },
      ]),
    })
  })

  it('ogni scarico finisce nello storico del magazzino con il numero dell\'ordine', async () => {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
    const m = movimenti('fil')
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ tipo: 'scarico', delta: -180, giacenzaDopo: 4820, unita: 'kg', nota: 'Ordine n. 7' })
    expect(movimenti('ane')[0]).toMatchObject({ delta: -10, giacenzaDopo: 90 })
  })

  it('non scala due volte: ripassare a "In preparazione" non tocca il magazzino', async () => {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
    await cambiaStatoOrdine('o1', 'pronto')
    await cambiaStatoOrdine('o1', 'in preparazione')
    expect(giacenza('fil')).toBe(4820)
    expect(movimenti('fil')).toHaveLength(1)
  })

  it('più righe: i materiali uguali si sommano e il prodotto senza ricetta non scala', async () => {
    ordine({
      righe: [
        { articoloId: 'seg', descrizione: 'A', quantita: 2, prezzoUnitarioCent: 250 },
        { articoloId: 'seg', descrizione: 'B', quantita: 3, prezzoUnitarioCent: 250 },
        { articoloId: 'sem', descrizione: 'Rivendita', quantita: 2, prezzoUnitarioCent: 100 },
      ],
    })
    await cambiaStatoOrdine('o1', 'in preparazione')
    expect(giacenza('fil')).toBe(5000 - 5 * 18)
    expect(giacenza('ane')).toBe(95)
    expect(giacenza('sem')).toBe(4) // la rivendita non ha ricetta
    expect(movimenti('fil')).toHaveLength(1) // un solo movimento per materiale
  })

  it('un ordine senza ricette cambia solo stato: nessun movimento e nessun campo di scarico', async () => {
    ordine({ righe: [{ articoloId: 'sem', descrizione: 'Rivendita', quantita: 1, prezzoUnitarioCent: 100 }] })
    await cambiaStatoOrdine('o1', 'in preparazione')
    const o = leggi('ordini/o1')!
    expect(o.stato).toBe('in preparazione')
    expect('scaricoMagazzino' in o).toBe(false)
    expect(elenco('movimenti')).toHaveLength(0)
  })

  it('righe scritte a mano (senza prodotto collegato) non scalano nulla', async () => {
    ordine({ righe: [{ descrizione: 'Segnaposto 3D', quantita: 10, prezzoUnitarioCent: 250 }] })
    await cambiaStatoOrdine('o1', 'in preparazione')
    expect(giacenza('fil')).toBe(5000)
    expect(elenco('movimenti')).toHaveLength(0)
  })

  it('un ingrediente sparito dal magazzino non rompe nulla: si scala il resto', async () => {
    ordine()
    azzeraIngrediente('ane')
    await cambiaStatoOrdine('o1', 'in preparazione')
    expect(giacenza('fil')).toBe(4820)
    expect(leggi('ordini/o1')!.stato).toBe('in preparazione')
  })

  it('applica anche i campi extra (es. data di spedizione)', async () => {
    ordine({ stato: 'pronto' })
    await cambiaStatoOrdine('o1', 'spedito', { extra: { dataSpedizione: '2026-11-23' } })
    expect(leggi('ordini/o1')).toMatchObject({ stato: 'spedito', dataSpedizione: '2026-11-23' })
  })

  it('un ordine che non esiste dà un errore chiaro', async () => {
    await expect(cambiaStatoOrdine('nessuno', 'in preparazione')).rejects.toBeInstanceOf(ErroreRegola)
  })
})

function azzeraIngrediente(id: string) {
  // toglie il materiale dal magazzino (come se fosse stato cancellato)
  const e = elenco('listino').filter((a) => a._id !== id)
  azzera()
  for (const a of e) {
    const { _id, ...dati } = a
    inserisci(`listino/${_id}`, dati)
  }
  ordine()
}

describe('cambiaStatoOrdine: se i materiali non bastano', () => {
  beforeEach(() => {
    azzera()
    magazzino({ fil: 300 }) // 300 g ma ne servono 540 per 30 pezzi
    ordine({ righe: [{ articoloId: 'seg', descrizione: 'Segnaposto 3D', quantita: 30, prezzoUnitarioCent: 250 }] })
  })

  it('senza "procedi comunque" lancia ErroreMateriali e non cambia NULLA (tutto o niente)', async () => {
    const errore = await cambiaStatoOrdine('o1', 'in preparazione').catch((e: unknown) => e)
    expect(errore).toBeInstanceOf(ErroreMateriali)
    expect((errore as ErroreMateriali).mancanti).toHaveLength(1)
    expect((errore as ErroreMateriali).mancanti[0]).toMatchObject({ articoloId: 'fil', necessaria: 540, disponibile: 300, mancante: 240 })
    expect(giacenza('fil')).toBe(300)
    expect(giacenza('ane')).toBe(100)
    expect(leggi('ordini/o1')!.stato).toBe('confermato')
    expect(elenco('movimenti')).toHaveLength(0)
  })

  it('con "procedi comunque" scala quanto c\'è, la giacenza non va sotto zero e lo storico dice cosa mancava', async () => {
    await cambiaStatoOrdine('o1', 'in preparazione', { procediComunque: true })
    expect(giacenza('fil')).toBe(0)
    expect(giacenza('ane')).toBe(70) // 30 anelli: bastavano
    const o = leggi('ordini/o1')!
    expect(o.stato).toBe('in preparazione')
    const voceFil = (o.scaricoMagazzino as { voci: { articoloId: string; necessaria: number; scalata: number }[] }).voci.find((v) => v.articoloId === 'fil')!
    expect(voceFil).toMatchObject({ necessaria: 540, scalata: 300 })
    expect(movimenti('fil')[0]).toMatchObject({ delta: -300, giacenzaDopo: 0, nota: 'Ordine n. 7 (ne mancavano 240 g)' })
  })

  it('un materiale già a zero non genera movimenti ma l\'ordine procede', async () => {
    azzera()
    magazzino({ fil: 0, ane: 100 })
    ordine({ righe: [{ articoloId: 'seg', descrizione: 'x', quantita: 5, prezzoUnitarioCent: 250 }] })
    await cambiaStatoOrdine('o1', 'in preparazione', { procediComunque: true })
    expect(movimenti('fil')).toHaveLength(0)
    expect(giacenza('ane')).toBe(95)
    expect(giacenza('fil')).toBe(0)
  })
})

describe('cambiaStatoOrdine: restituzione dei materiali', () => {
  async function inPreparazione() {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
  }

  it('se l\'ordine viene annullato i materiali tornano in magazzino e lo storico lo dice', async () => {
    await inPreparazione()
    await cambiaStatoOrdine('o1', 'annullato')
    expect(giacenza('fil')).toBe(5000)
    expect(giacenza('ane')).toBe(100)
    const o = leggi('ordini/o1')!
    expect(o.stato).toBe('annullato')
    expect('scaricoMagazzino' in o).toBe(false)
    const carico = movimenti('fil').find((m) => m.tipo === 'carico')!
    expect(carico).toMatchObject({ delta: 180, giacenzaDopo: 5000, nota: 'Ordine n. 7: materiali restituiti (ordine annullato)' })
  })

  it('tornando a "Confermato" si restituisce; rimettendo "In preparazione" si scala di nuovo (una sola volta)', async () => {
    await inPreparazione()
    await cambiaStatoOrdine('o1', 'confermato')
    expect(giacenza('fil')).toBe(5000)
    await cambiaStatoOrdine('o1', 'in preparazione')
    expect(giacenza('fil')).toBe(4820)
    expect(giacenza('ane')).toBe(90)
  })

  it('da "Pronto" l\'annullamento restituisce ancora', async () => {
    await inPreparazione()
    await cambiaStatoOrdine('o1', 'pronto')
    await cambiaStatoOrdine('o1', 'annullato')
    expect(giacenza('fil')).toBe(5000)
  })

  it('restituisce solo quello che era stato scalato davvero (con mancanze: 300 g, non 540)', async () => {
    azzera()
    magazzino({ fil: 300 })
    ordine({ righe: [{ articoloId: 'seg', descrizione: 'x', quantita: 30, prezzoUnitarioCent: 250 }] })
    await cambiaStatoOrdine('o1', 'in preparazione', { procediComunque: true })
    await cambiaStatoOrdine('o1', 'annullato')
    expect(giacenza('fil')).toBe(300)
    expect(giacenza('ane')).toBe(100)
  })

  it.each(['spedito', 'consegnato'] as const)('se l\'ordine era già %s la merce è partita: annullare NON restituisce', async (stato) => {
    await inPreparazione()
    await cambiaStatoOrdine('o1', 'pronto')
    await cambiaStatoOrdine('o1', stato === 'consegnato' ? 'spedito' : 'spedito')
    if (stato === 'consegnato') await cambiaStatoOrdine('o1', 'consegnato')
    await cambiaStatoOrdine('o1', 'annullato')
    expect(giacenza('fil')).toBe(4820)
    expect(giacenza('ane')).toBe(90)
    expect(leggi('ordini/o1')!.stato).toBe('annullato')
  })

  it('un materiale cancellato nel frattempo non blocca il ripristino degli altri', async () => {
    await inPreparazione()
    // il filamento viene eliminato dal magazzino
    const e = elenco('listino').filter((a) => a._id !== 'fil')
    const ordini = elenco('ordini')
    azzera()
    for (const a of e) {
      const { _id, ...dati } = a
      inserisci(`listino/${_id}`, dati)
    }
    for (const o of ordini) {
      const { _id, ...dati } = o
      inserisci(`ordini/${_id}`, dati)
    }
    await cambiaStatoOrdine('o1', 'annullato')
    expect(giacenza('ane')).toBe(100)
  })
})

describe('pagamenti e stato automatico, con i materiali', () => {
  it('il primo acconto conferma l\'ordine in attesa', async () => {
    ordine({ stato: 'in attesa acconto', pagamenti: [] })
    await aggiungiPagamento('o1', pagamento)
    expect(leggi('ordini/o1')).toMatchObject({ stato: 'confermato', pagamenti: [pagamento] })
  })

  it('togliere l\'unico acconto di un ordine in preparazione lo rimette in attesa e restituisce i materiali', async () => {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
    await rimuoviPagamento('o1', pagamento)
    const o = leggi('ordini/o1')!
    expect(o.stato).toBe('in attesa acconto')
    expect(o.pagamenti).toEqual([])
    expect('scaricoMagazzino' in o).toBe(false)
    expect(giacenza('fil')).toBe(5000)
    expect(giacenza('ane')).toBe(100)
    expect(movimenti('fil').find((m) => m.tipo === 'carico')?.nota).toMatch(/pagamento tolto/)
  })

  it('togliere un acconto quando ne restano altri non tocca stato né magazzino', async () => {
    ordine({ pagamenti: [pagamento, { importoCent: 300, data: '2026-11-10' }] })
    await cambiaStatoOrdine('o1', 'in preparazione')
    await rimuoviPagamento('o1', { importoCent: 300, data: '2026-11-10' })
    expect(leggi('ordini/o1')!.stato).toBe('in preparazione')
    expect(giacenza('fil')).toBe(4820)
  })

  it('l\'unico acconto di un ordine già spedito non si toglie: errore chiaro e niente cambia', async () => {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
    await cambiaStatoOrdine('o1', 'pronto')
    await cambiaStatoOrdine('o1', 'spedito')
    const errore = await rimuoviPagamento('o1', pagamento).catch((e: unknown) => e)
    expect(errore).toBeInstanceOf(ErroreRegola)
    expect((errore as Error).message).toMatch(/già partito/)
    expect(leggi('ordini/o1')).toMatchObject({ stato: 'spedito', pagamenti: [pagamento] })
    expect(giacenza('fil')).toBe(4820)
  })

  it('togliere un pagamento già rimosso da un altro utente non fa nulla', async () => {
    ordine({ pagamenti: [] })
    await expect(rimuoviPagamento('o1', pagamento)).resolves.toBeUndefined()
  })
})

describe('eliminaOrdine', () => {
  it('prima della spedizione restituisce i materiali e poi elimina', async () => {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
    await eliminaOrdine('o1')
    expect(leggi('ordini/o1')).toBeUndefined()
    expect(giacenza('fil')).toBe(5000)
    expect(movimenti('fil').find((m) => m.tipo === 'carico')?.nota).toMatch(/ordine eliminato/)
  })

  it('un ordine già spedito si elimina senza restituire (la merce è partita)', async () => {
    ordine()
    await cambiaStatoOrdine('o1', 'in preparazione')
    await cambiaStatoOrdine('o1', 'pronto')
    await cambiaStatoOrdine('o1', 'spedito')
    await eliminaOrdine('o1')
    expect(leggi('ordini/o1')).toBeUndefined()
    expect(giacenza('fil')).toBe(4820)
  })

  it('un ordine senza materiali scalati si elimina e basta', async () => {
    ordine()
    await eliminaOrdine('o1')
    expect(leggi('ordini/o1')).toBeUndefined()
    expect(giacenza('fil')).toBe(5000)
    expect(elenco('movimenti')).toHaveLength(0)
  })

  it('eliminare un ordine che non c\'è più non dà errore', async () => {
    await expect(eliminaOrdine('fantasma')).resolves.toBeUndefined()
  })
})

describe('creaOrdine e movimenti del magazzino (codice vero sul finto database)', () => {
  const base = {
    clienteId: 'c1',
    clienteNome: 'Maria',
    canale: 'WhatsApp' as const,
    righe: [{ articoloId: 'seg', descrizione: 'Segnaposto 3D', quantita: 1, prezzoUnitarioCent: 250 }],
    stato: 'in attesa acconto' as const,
    pagamenti: [],
  }

  it('i numeri ordine sono progressivi e il collegamento al prodotto viene salvato', async () => {
    const a = await creaOrdine(base)
    const b = await creaOrdine(base)
    expect([a.numero, b.numero]).toEqual([1, 2])
    expect((leggi(`ordini/${a.id}`)!.righe as { articoloId: string }[])[0].articoloId).toBe('seg')
  })

  it('carico, scarico e correzione aggiornano la giacenza e lo storico; uno scarico troppo grande è rifiutato', async () => {
    await registraMovimento('ane', 'carico', 50, 'Acquisto')
    expect(giacenza('ane')).toBe(150)
    await registraMovimento('ane', 'scarico', 20)
    expect(giacenza('ane')).toBe(130)
    await registraMovimento('ane', 'rettifica', 100, 'Inventario')
    expect(giacenza('ane')).toBe(100)
    await expect(registraMovimento('ane', 'scarico', 101)).rejects.toThrow(/Non basta: ne restano 100 pezzi/)
    expect(giacenza('ane')).toBe(100)
    expect(movimenti('ane')).toHaveLength(3)
  })

  it('creaArticolo con giacenza iniziale la registra come primo carico', async () => {
    const id = await creaArticolo({ nome: 'Nastro', tipo: 'materiale', unita: 'm', attivo: true }, 1250)
    expect(leggi(`listino/${id}`)!.giacenza).toBe(1250)
    expect(movimenti(id)[0]).toMatchObject({ tipo: 'carico', delta: 1250, nota: 'Giacenza iniziale' })
  })
})
