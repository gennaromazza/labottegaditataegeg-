import {
  avvisiOrdine,
  normalizzaStato,
  prossimaAzione,
  puoCambiareStato,
  rimozionePermessa,
  statoDopoNuovoPagamento,
  statoDopoRimozionePagamento,
  statoIniziale,
} from './stati'
import { ordineDiProva } from './fixture'
import type { StatoOrdine } from './tipi'

const pagato = { importoCent: 500, data: '2026-11-05' }

describe('statoIniziale', () => {
  it('senza acconto l\'ordine aspetta', () => expect(statoIniziale(0)).toBe('in attesa acconto'))
  it('con un acconto qualsiasi è confermato', () => expect(statoIniziale(1)).toBe('confermato'))
})

describe('normalizzaStato (ordini creati prima del nuovo flusso)', () => {
  it('"da fare" senza pagamenti → in attesa di acconto', () => expect(normalizzaStato('da fare', 0)).toBe('in attesa acconto'))
  it('"da fare" con acconto → confermato', () => expect(normalizzaStato('da fare', 500)).toBe('confermato'))
  it('"in lavorazione" → in preparazione', () => expect(normalizzaStato('in lavorazione', 0)).toBe('in preparazione'))
  it('gli stati nuovi restano', () => {
    expect(normalizzaStato('spedito', 0)).toBe('spedito')
    expect(normalizzaStato('annullato', 0)).toBe('annullato')
  })
  it('uno stato sconosciuto non rompe nulla', () => expect(normalizzaStato('boh', 0)).toBe('in attesa acconto'))
})

describe('puoCambiareStato: senza acconto non si procede', () => {
  it.each(['confermato', 'in preparazione', 'pronto', 'spedito', 'consegnato'] as const)('%s senza pagamenti è bloccato', (s) => {
    const r = puoCambiareStato(ordineDiProva(), s)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/acconto/)
  })
  it.each(['confermato', 'in preparazione', 'pronto', 'spedito', 'consegnato'] as const)('%s con un acconto è permesso', (s) => {
    expect(puoCambiareStato(ordineDiProva({ pagamenti: [pagato] }), s).ok).toBe(true)
  })
  it('annullare e tornare in attesa si può sempre', () => {
    expect(puoCambiareStato(ordineDiProva(), 'annullato').ok).toBe(true)
    expect(puoCambiareStato(ordineDiProva({ pagamenti: [pagato], stato: 'pronto' }), 'in attesa acconto').ok).toBe(true)
  })
})

describe('stato dopo un pagamento', () => {
  it('il primo acconto conferma l\'ordine', () => {
    expect(statoDopoNuovoPagamento('in attesa acconto', 500)).toBe('confermato')
    expect(statoDopoNuovoPagamento('da fare', 500)).toBe('confermato')
  })
  it('un ordine già avanti non torna indietro', () => {
    expect(statoDopoNuovoPagamento('in preparazione', 500)).toBeNull()
    expect(statoDopoNuovoPagamento('annullato', 500)).toBeNull()
  })
  it('un pagamento nullo non conferma', () => expect(statoDopoNuovoPagamento('in attesa acconto', 0)).toBeNull())
  it('togliere l\'unico acconto di un ordine solo confermato lo rimette in attesa', () => {
    expect(statoDopoRimozionePagamento('confermato', 0)).toBe('in attesa acconto')
  })
  it('se resta del versato, o se l\'ordine è più avanti, lo stato non cambia (si avvisa e basta)', () => {
    expect(statoDopoRimozionePagamento('confermato', 200)).toBeNull()
    expect(statoDopoRimozionePagamento('in preparazione', 0)).toBeNull()
  })
})

describe('rimozionePermessa: non si toglie l\'unico acconto di un ordine già avanti', () => {
  it.each(['in preparazione', 'pronto', 'spedito', 'consegnato', 'in lavorazione'])('%s con versato 0: bloccato', (s) => {
    const r = rimozionePermessa(s, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/cambia lo stato/)
  })
  it.each(['in attesa acconto', 'confermato', 'annullato', 'da fare'])('%s: permesso', (s) => {
    expect(rimozionePermessa(s, 0).ok).toBe(true)
  })
  it('se resta del versato si può sempre', () => {
    expect(rimozionePermessa('spedito', 300).ok).toBe(true)
  })
})

describe('prossimaAzione', () => {
  const o = (stato: StatoOrdine, pag = true) =>
    ordineDiProva({ stato, pagamenti: pag ? [pagato] : [] })
  it('in attesa senza pagamenti: nessuna azione', () => expect(prossimaAzione(o('in attesa acconto', false))).toBeNull())
  it('in attesa ma con acconto: conferma', () => expect(prossimaAzione(o('in attesa acconto'))).toEqual({ stato: 'confermato', etichetta: 'Conferma ordine' }))
  it('confermato → preparazione', () => expect(prossimaAzione(o('confermato'))?.stato).toBe('in preparazione'))
  it('preparazione → pronto', () => expect(prossimaAzione(o('in preparazione'))?.stato).toBe('pronto'))
  it('pronto → spedito', () => expect(prossimaAzione(o('pronto'))).toEqual({ stato: 'spedito', etichetta: 'Segna come spedito' }))
  it('spedito → consegnato', () => expect(prossimaAzione(o('spedito'))?.stato).toBe('consegnato'))
  it('consegnato e annullato sono finali', () => {
    expect(prossimaAzione(o('consegnato'))).toBeNull()
    expect(prossimaAzione(o('annullato'))).toBeNull()
  })
  it('un ordine avanti senza pagamenti non può proseguire', () => expect(prossimaAzione(o('confermato', false))).toBeNull())
})

describe('avvisiOrdine', () => {
  it('in attesa di acconto: spiega che non si procede', () => {
    expect(avvisiOrdine(ordineDiProva()).join(' ')).toMatch(/non si procede/i)
  })
  it('ordine avanti ma senza pagamenti (es. pagamento rimosso): avviso', () => {
    expect(avvisiOrdine(ordineDiProva({ stato: 'in preparazione' })).join(' ')).toMatch(/nessun pagamento/i)
  })
  it('ordine regolare: nessun avviso', () => {
    expect(avvisiOrdine(ordineDiProva({ stato: 'pronto', pagamenti: [pagato] }))).toEqual([])
    expect(avvisiOrdine(ordineDiProva({ stato: 'annullato' }))).toEqual([])
  })
})
