import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Listino from './Listino'

const h = vi.hoisted(() => ({ salva: vi.fn() }))

vi.mock('../data/listino', () => ({
  ascoltaListino: (cb: (v: unknown[]) => void) => {
    cb([{ id: 'l1', nome: 'Candela grande', prezzoCent: 800, attivo: true }])
    return () => {}
  },
  salvaVoceListino: (...a: unknown[]) => h.salva(...a),
}))

beforeEach(() => h.salva.mockReset())

it('aggiunge una voce', async () => {
  render(<Listino />)
  await userEvent.type(screen.getByLabelText('Nome del prodotto'), 'Segnaposto')
  await userEvent.type(screen.getByLabelText('Prezzo (€)'), '2,50')
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al listino' }))
  expect(h.salva).toHaveBeenCalledWith({ nome: 'Segnaposto', prezzoCent: 250, attivo: true })
})

it('modifica il prezzo', async () => {
  render(<Listino />)
  const campo = screen.getByLabelText('Prezzo di Candela grande (€)')
  await userEvent.clear(campo)
  await userEvent.type(campo, '9')
  await userEvent.click(screen.getByRole('button', { name: 'Salva prezzo di Candela grande' }))
  expect(h.salva).toHaveBeenCalledWith({ id: 'l1', nome: 'Candela grande', prezzoCent: 900, attivo: true })
})

it('disattiva una voce', async () => {
  render(<Listino />)
  await userEvent.click(screen.getByRole('button', { name: /Disattiva Candela grande/ }))
  expect(h.salva).toHaveBeenCalledWith({ id: 'l1', nome: 'Candela grande', prezzoCent: 800, attivo: false })
})

it('nome o prezzo mancanti non salvano', async () => {
  render(<Listino />)
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al listino' }))
  expect(await screen.findByText('Scrivi il nome e un prezzo valido')).toBeInTheDocument()
  expect(h.salva).not.toHaveBeenCalled()
})
