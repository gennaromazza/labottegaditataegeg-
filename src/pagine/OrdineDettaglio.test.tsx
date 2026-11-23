import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OrdineDettaglio from './OrdineDettaglio'
import { ordineDiProva } from '../lib/fixture'
import type { Ordine, Pagamento } from '../lib/tipi'

const h = vi.hoisted(() => ({
  ordine: null as unknown as Ordine,
  cb: null as null | ((o: Ordine) => void),
}))

vi.mock('../data/ordini', () => ({
  ascoltaOrdine: (_id: string, cb: (o: Ordine) => void) => {
    h.cb = cb
    cb(h.ordine)
    return () => {}
  },
  aggiornaOrdine: vi.fn(),
  rimuoviPagamento: vi.fn(),
  aggiungiPagamento: async (_id: string, p: Pagamento) => {
    h.ordine = { ...h.ordine, pagamenti: [...h.ordine.pagamenti, p] }
    h.cb?.(h.ordine)
  },
}))

const apri = () =>
  render(
    <MemoryRouter initialEntries={['/ordini/o1']}>
      <Routes>
        <Route path="/ordini/:id" element={<OrdineDettaglio />} />
      </Routes>
    </MemoryRouter>,
  )

it('un secondo acconto porta lo stato da acconto a saldato', async () => {
  h.ordine = ordineDiProva({ pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
  apri()
  expect(screen.getByText('Acconto versato')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Importo (€)'), '12,50')
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi pagamento' }))
  expect(await screen.findByText('Saldato')).toBeInTheDocument()
})

it('senza telefono WhatsApp è disabilitato con suggerimento', () => {
  h.ordine = ordineDiProva({ clienteTelefono: undefined })
  apri()
  expect(screen.getByRole('button', { name: 'Invia su WhatsApp' })).toBeDisabled()
  expect(screen.getByText('Aggiungi il telefono del cliente')).toBeInTheDocument()
})

it('con telefono il link WhatsApp è un wa.me', () => {
  h.ordine = ordineDiProva()
  apri()
  const a = screen.getByRole('link', { name: 'Invia su WhatsApp' })
  expect(a.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/393331234567\?text=/)
})

it('annullato con versato mostra Da rimborsare', () => {
  h.ordine = ordineDiProva({ stato: 'annullato', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
  apri()
  expect(screen.getByText('Da rimborsare')).toBeInTheDocument()
})

it('pagamento oltre il totale: eccesso mostrato, nessun crash', () => {
  h.ordine = ordineDiProva({ pagamenti: [{ importoCent: 2000, data: '2026-11-05' }] })
  apri()
  expect(screen.getByText('Pagato in eccesso')).toBeInTheDocument()
  expect(screen.getByText('Pagato in più')).toBeInTheDocument()
})

it('importo non valido non registra il pagamento', async () => {
  h.ordine = ordineDiProva()
  apri()
  await userEvent.type(screen.getByLabelText('Importo (€)'), 'abc')
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi pagamento' }))
  expect(await screen.findByText('Scrivi un importo valido')).toBeInTheDocument()
})
