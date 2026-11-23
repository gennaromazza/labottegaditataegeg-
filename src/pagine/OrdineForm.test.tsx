import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import OrdineForm from './OrdineForm'
import Ordini from './Ordini'
import { ordineDiProva } from '../lib/fixture'

const h = vi.hoisted(() => ({ crea: vi.fn() }))

vi.mock('../data/clienti', () => ({
  ascoltaClienti: (cb: (c: unknown[]) => void) => {
    cb([{ id: 'c1', nome: 'Maria Rossi', telefono: '333 1234567' }])
    return () => {}
  },
  ascoltaCliente: (id: string, cb: (c: unknown) => void) => {
    cb(id === 'c1' ? { id: 'c1', nome: 'Maria Rossi', telefono: '333 1234567' } : null)
    return () => {}
  },
  creaCliente: vi.fn(),
}))
vi.mock('../data/listino', () => ({
  ascoltaListino: (cb: (v: unknown[]) => void) => {
    cb([{ id: 'l1', nome: 'Candela grande', prezzoCent: 800, attivo: true }])
    return () => {}
  },
}))
vi.mock('../data/ordini', () => ({
  creaOrdine: (...a: unknown[]) => h.crea(...a),
  ascoltaOrdini: (cb: (o: unknown[]) => void) => {
    cb([
      ordineDiProva({ id: 'a', numero: 1, stato: 'pronto' }),
      ordineDiProva({ id: 'b', numero: 2, stato: 'da fare', clienteNome: 'Luca Bianchi', canale: 'TikTok' }),
    ])
    return () => {}
  },
}))

beforeEach(() => {
  h.crea.mockReset()
  h.crea.mockResolvedValue({ id: 'nuovo' })
})

const apri = () =>
  render(
    <MemoryRouter>
      <OrdineForm />
    </MemoryRouter>,
  )

async function scegliCliente() {
  await userEvent.type(screen.getByLabelText(/Cerca cliente/), 'mar')
  await userEvent.click(screen.getByRole('button', { name: /Maria Rossi/ }))
}

it('dalla scheda cliente (?cliente=) il cliente è già scelto', async () => {
  render(
    <MemoryRouter initialEntries={['/ordini/nuovo?cliente=c1']}>
      <OrdineForm />
    </MemoryRouter>,
  )
  expect(await screen.findByText(/Maria Rossi · 333 1234567/)).toBeInTheDocument()
  expect(screen.queryByLabelText(/Cerca cliente/)).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Candela')
  await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '8')
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(h.crea.mock.calls[0][0].clienteId).toBe('c1')
})

it('un cliente inesistente nel link non rompe il form', async () => {
  render(
    <MemoryRouter initialEntries={['/ordini/nuovo?cliente=zzz']}>
      <OrdineForm />
    </MemoryRouter>,
  )
  expect(screen.getByLabelText(/Cerca cliente/)).toBeInTheDocument()
})

it('senza cliente o senza righe non invia', async () => {
  apri()
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(await screen.findByText('Scegli o crea il cliente')).toBeInTheDocument()
  await scegliCliente()
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(await screen.findByText(/almeno un prodotto/)).toBeInTheDocument()
  expect(h.crea).not.toHaveBeenCalled()
})

it('il totale si aggiorna e l\'acconto diventa il primo pagamento', async () => {
  apri()
  await scegliCliente()
  await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Segnaposto')
  await userEvent.clear(screen.getByLabelText('Quantità 1'))
  await userEvent.type(screen.getByLabelText('Quantità 1'), '2')
  await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '3,50')
  await userEvent.click(screen.getByRole('button', { name: '+ Aggiungi riga' }))
  await userEvent.type(screen.getByLabelText('Prodotto 2'), 'Candela')
  await userEvent.type(screen.getByLabelText(/Prezzo unitario 2/), '10')
  expect(screen.getByTestId('totale').textContent).toMatch(/17,00/)
  await userEvent.type(screen.getByLabelText(/Acconto ricevuto/), '5')
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(h.crea).toHaveBeenCalledTimes(1)
  const arg = h.crea.mock.calls[0][0]
  expect(arg.clienteId).toBe('c1')
  expect(arg.righe).toHaveLength(2)
  expect(arg.pagamenti).toEqual([{ importoCent: 500, data: expect.any(String) }])
})

it('il listino precompila nome e prezzo, modificabili', async () => {
  apri()
  await userEvent.selectOptions(screen.getByLabelText('Aggiungi dal listino'), 'l1')
  expect(screen.getByLabelText('Prodotto 1')).toHaveValue('Candela grande')
  expect(screen.getByLabelText(/Prezzo unitario 1/)).toHaveValue('8,00')
  await userEvent.clear(screen.getByLabelText(/Prezzo unitario 1/))
  await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '9')
  expect(screen.getByTestId('totale').textContent).toMatch(/9,00/)
})

it('riga compilata a metà blocca il salvataggio', async () => {
  apri()
  await scegliCliente()
  await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Segnaposto')
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(await screen.findByText(/almeno un prodotto/)).toBeInTheDocument()
  expect(h.crea).not.toHaveBeenCalled()
})

it('Stampa elenco apre la stampa del browser', async () => {
  const stampa = vi.fn()
  window.print = stampa
  render(
    <MemoryRouter>
      <Ordini />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Stampa elenco' }))
  expect(stampa).toHaveBeenCalledTimes(1)
})

it('i filtri della lista per stato e canale', async () => {
  render(
    <MemoryRouter>
      <Ordini />
    </MemoryRouter>,
  )
  expect(screen.getAllByText(/^n\. /)).toHaveLength(2)
  await userEvent.selectOptions(screen.getByLabelText('Stato'), 'pronto')
  expect(screen.getAllByText(/^n\. /)).toHaveLength(1)
  await userEvent.selectOptions(screen.getByLabelText('Stato'), '')
  await userEvent.selectOptions(screen.getByLabelText('Canale'), 'TikTok')
  expect(screen.getByText(/Luca Bianchi/)).toBeInTheDocument()
  expect(screen.getAllByText(/^n\. /)).toHaveLength(1)
})
