import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Incassi from './Incassi'
import { ordineDiProva } from '../lib/fixture'

vi.mock('../data/ordini', () => ({
  ascoltaOrdini: (cb: (o: unknown[]) => void) => {
    cb([
      ordineDiProva({
        id: 'a',
        canale: 'WhatsApp',
        pagamenti: [
          { importoCent: 500, data: '2026-11-05', metodo: 'contanti' },
          { importoCent: 300, data: '2026-12-01' },
        ],
      }),
      ordineDiProva({
        id: 'b',
        numero: 8,
        canale: 'TikTok',
        stato: 'annullato',
        pagamenti: [{ importoCent: 200, data: '2026-11-10', metodo: 'bonifico' }],
      }),
    ])
    return () => {}
  },
}))

function imposta(da: string, a: string) {
  fireEvent.change(screen.getByLabelText('Dal'), { target: { value: da } })
  fireEvent.change(screen.getByLabelText('Al'), { target: { value: a } })
}

const apri = () =>
  render(
    <MemoryRouter>
      <Incassi />
    </MemoryRouter>,
  )

it('mostra totale del periodo, canali, metodi e residuo', () => {
  apri()
  imposta('2026-11-01', '2026-11-30')
  expect(screen.getByTestId('totale-periodo').textContent).toMatch(/7,00/)
  expect(screen.getByText('TikTok')).toBeInTheDocument()
  expect(screen.getByText('contanti')).toBeInTheDocument()
  expect(screen.getByText('bonifico')).toBeInTheDocument()
  // ordine a: totale 17,50 - versato 8,00 = 9,50; l'annullato non conta
  expect(screen.getByTestId('da-incassare').textContent).toMatch(/9,50/)
})

it('cambiando periodo i numeri cambiano', () => {
  apri()
  imposta('2026-11-01', '2026-12-31')
  expect(screen.getByTestId('totale-periodo').textContent).toMatch(/10,00/)
  imposta('2026-12-01', '2026-12-31')
  expect(screen.getByTestId('totale-periodo').textContent).toMatch(/3,00/)
})

it('segnala i rimborsi da fare', () => {
  apri()
  expect(screen.getByText('Da rimborsare')).toBeInTheDocument()
  expect(screen.getByText(/Ordine n\. 8/)).toBeInTheDocument()
})
