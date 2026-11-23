import { residuoCent, spedizioneCent, statoPagamento, totaleOrdineCent } from './calcoli'
import { ordineDiProva } from './fixture'
import { generaPdfOrdine } from './pdf'
import { messaggioOrdine, messaggioSpedizione } from './whatsapp'

const pag = (importoCent: number) => ({ importoCent, data: '2026-11-05' })
// ordineDiProva: righe per 17,50 €

describe('totale dell\'ordine con la spedizione', () => {
  it('senza costo di spedizione il totale è quello dei prodotti (ordini vecchi invariati)', () => {
    expect(totaleOrdineCent(ordineDiProva())).toBe(1750)
    expect(spedizioneCent(ordineDiProva())).toBe(0)
  })
  it('con 5,90 € di spedizione: 17,50 + 5,90 = 23,40', () => {
    expect(totaleOrdineCent(ordineDiProva({ costoSpedizioneCent: 590 }))).toBe(2340)
    expect(spedizioneCent(ordineDiProva({ costoSpedizioneCent: 590 }))).toBe(590)
  })
  it('spedizione gratuita (0) non cambia il totale', () => {
    expect(totaleOrdineCent(ordineDiProva({ costoSpedizioneCent: 0 }))).toBe(1750)
  })
  it('un valore non valido (negativo o non numerico) non deve sporcare i conti', () => {
    expect(totaleOrdineCent(ordineDiProva({ costoSpedizioneCent: -300 }))).toBe(1750)
    expect(totaleOrdineCent(ordineDiProva({ costoSpedizioneCent: Number.NaN }))).toBe(1750)
  })
})

describe('residuo e stato del pagamento comprendono la spedizione', () => {
  const o = (versato: number) => ordineDiProva({ costoSpedizioneCent: 590, pagamenti: versato ? [pag(versato)] : [] })
  it('il residuo è il totale con spedizione meno il versato', () => {
    expect(residuoCent(o(500))).toBe(1840)
    expect(residuoCent(o(0))).toBe(2340)
  })
  it('pagando solo i prodotti l\'ordine NON è saldato: manca la spedizione', () => {
    expect(statoPagamento(o(1750))).toBe('acconto')
    expect(residuoCent(o(1750))).toBe(590)
  })
  it('pagando tutto, spedizione compresa, è saldato', () => {
    expect(statoPagamento(o(2340))).toBe('saldato')
  })
  it('pagando di più è eccedente', () => expect(statoPagamento(o(2400))).toBe('eccedente'))
})

describe('messaggio WhatsApp con la spedizione', () => {
  it('mostra la riga della spedizione e il totale "spedizione compresa"', () => {
    const m = messaggioOrdine(ordineDiProva({ costoSpedizioneCent: 590, pagamenti: [pag(500)] }))
    expect(m).toContain('Spedizione: 5,90')
    expect(m).toContain('Totale (spedizione compresa): 23,40')
    expect(m).toContain('Versato: 5,00')
    expect(m).toContain('Da saldare: 18,40')
  })

  it('la riga della spedizione sta dopo i prodotti e prima del totale', () => {
    const m = messaggioOrdine(ordineDiProva({ costoSpedizioneCent: 590 }))
    expect(m.indexOf('Segnaposto')).toBeLessThan(m.indexOf('Spedizione: 5,90'))
    expect(m.indexOf('Spedizione: 5,90')).toBeLessThan(m.indexOf('Totale (spedizione compresa)'))
  })

  it('spedizione a zero: "Spedizione gratuita" e il totale resta quello dei prodotti', () => {
    const m = messaggioOrdine(ordineDiProva({ costoSpedizioneCent: 0 }))
    expect(m).toContain('Spedizione gratuita')
    expect(m).toContain('Totale: 17,50')
    expect(m).not.toContain('spedizione compresa')
  })

  it('senza costo di spedizione (ordini vecchi o ritiro) non compare nessuna riga di spedizione', () => {
    const m = messaggioOrdine(ordineDiProva())
    expect(m).not.toMatch(/Spedizione|spedizione/)
    expect(m).toContain('Totale: 17,50')
  })

  it('il messaggio di spedizione avvenuta ricorda il saldo comprensivo della spedizione', () => {
    const m = messaggioSpedizione(ordineDiProva({ stato: 'spedito', costoSpedizioneCent: 590, pagamenti: [pag(1750)] }))
    expect(m).toContain('5,90')
    expect(m).toMatch(/restano da saldare/)
  })

  it('con tutto pagato (spedizione compresa) il messaggio di spedizione non chiede altro', () => {
    const m = messaggioSpedizione(ordineDiProva({ stato: 'spedito', costoSpedizioneCent: 590, pagamenti: [pag(2340)] }))
    expect(m).not.toMatch(/saldare/)
  })
})

describe('PDF con la spedizione', () => {
  const testoPdf = async (o: Parameters<typeof generaPdfOrdine>[0]) =>
    new TextDecoder('latin1').decode(await (await generaPdfOrdine(o)).arrayBuffer())

  it('con la spedizione il PDF ha la riga e il totale giusto', async () => {
    const t = await testoPdf(ordineDiProva({ costoSpedizioneCent: 590 }))
    expect(t).toMatch(/\(Spedizione\)/)
    expect(t).toMatch(/23,40/)
  })
  it('spedizione gratuita: la riga c\'è e dice gratuita', async () => {
    const t = await testoPdf(ordineDiProva({ costoSpedizioneCent: 0 }))
    expect(t).toMatch(/\(Spedizione gratuita\)/)
  })
  it('senza costo di spedizione il PDF non ha la riga', async () => {
    const t = await testoPdf(ordineDiProva())
    expect(t).not.toMatch(/Spedizione/)
    expect(t).toMatch(/17,50/)
  })
})
