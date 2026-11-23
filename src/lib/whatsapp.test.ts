import { linkWhatsApp, messaggioOrdine, normalizzaTelefono } from './whatsapp'
import { ordineDiProva } from './fixture'

describe('normalizzaTelefono', () => {
  it.each([
    ['333 123-4567', '393331234567'],
    ['+39 333 1234567', '393331234567'],
    ['0039 333 1234567', '393331234567'],
    ['+44 7700 900123', '447700900123'],
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
    expect(m).toContain('n. 7')
    expect(m).toContain('Maria Rossi')
    expect(m).toContain('Segnaposto')
    expect(m).toContain('Mario')
    expect(m).toContain('17,50')
    expect(m).toContain('5,00')
    expect(m).toContain('12,50')
    expect(m).toContain('10/12/2026')
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
