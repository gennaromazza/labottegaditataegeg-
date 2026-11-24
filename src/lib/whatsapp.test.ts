import { linkSpedizione, linkWhatsApp, messaggioOrdine, messaggioSpedizione, normalizzaTelefono } from './whatsapp'
import { ordineDiProva } from './fixture'

describe('normalizzaTelefono', () => {
  it.each([
    ['333 123-4567', '393331234567'],
    ['+39 333 1234567', '393331234567'],
    ['0039 333 1234567', '393331234567'],
    ['+44 7700 900123', '447700900123'],
    ['39 333 1234567', '393331234567'],
    ['393331234567', '393331234567'],
    ['3931234567', '393931234567'], // numero nazionale di 10 cifre che inizia per 39
    ['081 1234567', '390811234567'],
  ])('%s', (raw, atteso) => expect(normalizzaTelefono(raw)).toBe(atteso))
  it('vuoto o non numerico = null', () => {
    expect(normalizzaTelefono('')).toBeNull()
    expect(normalizzaTelefono('abc')).toBeNull()
  })
})

describe('messaggioOrdine', () => {
  it('contiene i dati chiave', () => {
    const m = messaggioOrdine(
      ordineDiProva({ dataConsegna: '2026-12-10', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] }),
    )
    expect(m).toContain('Ciao Maria Rossi! Ecco il riepilogo del tuo ordine – La Bottega di Tata e Gegè')
    expect(m).toContain('Segnaposto')
    expect(m).toContain('Mario')
    expect(m).toContain('17,50')
    expect(m).toContain('5,00')
    expect(m).toContain('12,50')
    expect(m).toContain('10/12/2026')
  })
})

describe('messaggioOrdine: riga del residuo', () => {
  const pag = (importoCent: number) => ({ importoCent, data: '2026-11-05' })
  it('eccedente → "Pagato in più", mai un importo negativo', () => {
    const m = messaggioOrdine(ordineDiProva({ pagamenti: [pag(2000)] }))
    expect(m).toContain('Pagato in più')
    expect(m).not.toContain('-')
  })
  it('saldato', () => expect(messaggioOrdine(ordineDiProva({ pagamenti: [pag(1750)] }))).toContain('Saldato'))
  it('annullato', () => expect(messaggioOrdine(ordineDiProva({ stato: 'annullato' }))).toContain('Ordine annullato'))
})

describe('messaggioSpedizione', () => {
  const indirizzo = { destinatario: 'Anna Rossi', indirizzo: 'Via Roma 1', cap: '81031', citta: 'Aversa', provincia: 'CE' }
  const spedito = (extra = {}) => ordineDiProva({ stato: 'spedito', pagamenti: [{ importoCent: 1750, data: '2026-11-05' }], ...extra })

  it('è un messaggio cordiale con nome e prodotti', () => {
    const m = messaggioSpedizione(spedito())
    expect(m).toContain('Ciao Maria Rossi')
    expect(m).toContain('il tuo ordine è stato spedito')
    expect(m).toContain('spedito')
    expect(m).toContain('3 × Segnaposto (Mario)')
    expect(m).toContain('La Bottega di Tata e Gegè')
    expect(m).toMatch(/Grazie/)
  })
  it('include corriere e codice di tracciamento se presenti', () => {
    const m = messaggioSpedizione(spedito({ corriere: 'GLS', tracking: 'AB123456' }))
    expect(m).toContain('Corriere: GLS')
    expect(m).toContain('AB123456')
  })
  it('senza corriere né tracking non lascia righe vuote o "undefined"', () => {
    const m = messaggioSpedizione(spedito())
    expect(m).not.toMatch(/undefined|Corriere|tracciamento/)
  })
  it('indica dove arriva se l\'indirizzo è noto', () => {
    const m = messaggioSpedizione(spedito(), indirizzo)
    expect(m).toContain('Anna Rossi, Via Roma 1, 81031 Aversa (CE)')
    expect(messaggioSpedizione(spedito())).not.toContain('Via Roma')
  })
  it('ricorda il saldo solo se resta qualcosa da pagare', () => {
    expect(messaggioSpedizione(spedito())).not.toMatch(/saldo|da saldare/i)
    const conResiduo = messaggioSpedizione(spedito({ pagamenti: [{ importoCent: 500, data: '2026-11-05' }] }))
    expect(conResiduo).toContain('12,50')
  })
})

describe('linkSpedizione', () => {
  it('apre WhatsApp sul telefono del cliente con il testo codificato', () => {
    const url = linkSpedizione(ordineDiProva({ stato: 'spedito', clienteTelefono: '333 123-4567', righe: [{ descrizione: 'Nome & Co', quantita: 1, prezzoUnitarioCent: 100 }] }))!
    expect(url.startsWith('https://wa.me/393331234567?text=')).toBe(true)
    expect(url.split('?text=')[1]).toContain('%26')
  })
  it('senza telefono non c\'è link', () => {
    expect(linkSpedizione(ordineDiProva({ clienteTelefono: undefined }))).toBeNull()
  })
})

describe('linkWhatsApp', () => {
  it('codifica i caratteri speciali', () => {
    const o = ordineDiProva({
      righe: [{ descrizione: 'Nome', testoPersonalizzato: 'Mario & Lu #1 😀\nok', quantita: 1, prezzoUnitarioCent: 100 }],
    })
    const url = linkWhatsApp(o)!
    expect(url.startsWith('https://wa.me/393331234567?text=')).toBe(true)
    const testo = url.split('?text=')[1]
    expect(testo).toContain('%26')
    expect(testo).toContain('%23')
    expect(testo).toContain('%0A')
    expect(testo).not.toMatch(/[&# \n]/)
  })
  it('senza telefono = null', () => {
    expect(linkWhatsApp(ordineDiProva({ clienteTelefono: undefined }))).toBeNull()
  })
})

describe('il numero d\'ordine non si vede mai al cliente (rivelerebbe quanti ordini avete fatto)', () => {
  it.each([1, 7, 10, 123])('né nel riepilogo né nell\'avviso di spedizione, con l\'ordine n. %i', (numero) => {
    const o = ordineDiProva({ numero, stato: 'spedito', corriere: 'GLS', tracking: 'AB1', costoSpedizioneCent: 590, pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
    for (const testo of [messaggioOrdine(o), messaggioSpedizione(o)]) {
      expect(testo).not.toMatch(/n\.\s*\d/)
      expect(testo).not.toMatch(/numero|n°|#\d/i)
      expect(testo).not.toContain(`ordine ${numero}`)
    }
  })

  it('il link WhatsApp, decodificato, non contiene il numero', () => {
    const o = ordineDiProva({ numero: 10 })
    const url = linkWhatsApp(o)!
    expect(decodeURIComponent(url.split('?text=')[1])).not.toMatch(/n\.\s*10|ordine 10/)
  })
})
