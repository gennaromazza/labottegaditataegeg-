import { generaPdfOrdine, sicuroPerPdf } from './pdf'
import { ordineDiProva } from './fixture'

it('sicuroPerPdf toglie emoji ma tiene accenti, € e a capo', () => {
  expect(sicuroPerPdf('Gegè 😀 costa 5 €\nok')).toBe('Gegè  costa 5 €\nok')
})

it('genera un PDF non vuoto anche con emoji e &', async () => {
  const o = ordineDiProva({
    righe: [{ descrizione: 'Nome', testoPersonalizzato: 'Mario & Lu #1 😀\nok', quantita: 2, prezzoUnitarioCent: 350 }],
    dataConsegna: '2026-12-10',
  })
  const blob = await generaPdfOrdine(o)
  expect(blob.type).toBe('application/pdf')
  expect(blob.size).toBeGreaterThan(500)
})

it('un logo non valido non blocca la generazione', async () => {
  const blob = await generaPdfOrdine(ordineDiProva(), 'data:image/png;base64,AAAA')
  expect(blob.size).toBeGreaterThan(500)
})
