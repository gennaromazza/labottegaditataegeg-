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

it('con molte righe i totali vanno su una nuova pagina e non fuori dal foglio', async () => {
  const righe = Array.from({ length: 45 }, (_, i) => ({ descrizione: `Prodotto ${i}`, quantita: 1, prezzoUnitarioCent: 100 }))
  const blob = await generaPdfOrdine(ordineDiProva({ righe }))
  const testo = new TextDecoder('latin1').decode(await blob.arrayBuffer())
  expect((testo.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(2)
})

it('un logo non valido non blocca la generazione', async () => {
  const blob = await generaPdfOrdine(ordineDiProva(), 'data:image/png;base64,AAAA')
  expect(blob.size).toBeGreaterThan(500)
})

it('il PDF, che va al cliente, non riporta il numero d\'ordine', async () => {
  for (const numero of [7, 10, 123]) {
    const blob = await generaPdfOrdine(ordineDiProva({ numero }))
    const testo = new TextDecoder('latin1').decode(await blob.arrayBuffer())
    expect(testo).toMatch(/\(Riepilogo ordine\)/)
    expect(testo).not.toContain(`n. ${numero}`)
    expect(testo).not.toContain(`ordine ${numero}`)
  }
})
