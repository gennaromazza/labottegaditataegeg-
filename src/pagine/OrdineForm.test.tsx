import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import OrdineForm from './OrdineForm'
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
vi.mock('../data/magazzino', () => ({
  ascoltaArticoli: (cb: (v: unknown[]) => void) => {
    cb([
      { id: 'l1', nome: 'Candela grande', tipo: 'prodotto', unita: 'pezzi', giacenza: 0, prezzoCent: 800, attivo: true },
      { id: 'l2', nome: 'Segnaposto nome', tipo: 'prodotto', unita: 'pezzi', giacenza: 0, prezzoCent: 250, attivo: true },
      { id: 'l3', nome: 'Vecchio prodotto', tipo: 'prodotto', unita: 'pezzi', giacenza: 0, prezzoCent: 100, attivo: false },
      { id: 'l4', nome: 'Cera di soia', tipo: 'materiale', unita: 'kg', giacenza: 5000, attivo: true },
      { id: 'l5', nome: 'Nastro raso', tipo: 'prodotto', unita: 'm', giacenza: 0, prezzoCent: 150, attivo: true },
      { id: 'l6', nome: 'Prodotto senza prezzo', tipo: 'prodotto', unita: 'pezzi', giacenza: 0, attivo: true },
    ])
    return () => {}
  },
}))
vi.mock('../data/ordini', () => ({
  creaOrdine: (...a: unknown[]) => h.crea(...a),
  ascoltaOrdini: (cb: (o: unknown[]) => void) => {
    cb([
      ordineDiProva({ id: 'a', numero: 1, stato: 'pronto' }),
      ordineDiProva({ id: 'b', numero: 2, stato: 'confermato', clienteNome: 'Luca Bianchi', canale: 'TikTok' }),
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

it('senza acconto l\'ordine resta in attesa di acconto', async () => {
  apri()
  await scegliCliente()
  await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Candela')
  await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '8')
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(h.crea.mock.calls[0][0].stato).toBe('in attesa acconto')
  expect(h.crea.mock.calls[0][0].pagamenti).toEqual([])
})

it('con un acconto l\'ordine nasce confermato', async () => {
  apri()
  await scegliCliente()
  await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Candela')
  await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '8')
  await userEvent.type(screen.getByLabelText(/Acconto ricevuto/), '2')
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(h.crea.mock.calls[0][0].stato).toBe('confermato')
})

it('il listino precompila nome e prezzo, modificabili', async () => {
  apri()
  await userEvent.click(screen.getByRole('button', { name: /Candela grande · 8,00/ }))
  expect(screen.getByLabelText('Prodotto 1')).toHaveValue('Candela grande')
  expect(screen.getByLabelText(/Prezzo unitario 1/)).toHaveValue('8,00')
  await userEvent.clear(screen.getByLabelText(/Prezzo unitario 1/))
  await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '9')
  expect(screen.getByTestId('totale').textContent).toMatch(/9,00/)
})

it('toccare due volte lo stesso prodotto aumenta la quantità, un altro prodotto aggiunge una riga', async () => {
  apri()
  const candela = screen.getByRole('button', { name: /Candela grande · 8,00/ })
  await userEvent.click(candela)
  await userEvent.click(candela)
  expect(screen.getByLabelText('Quantità 1')).toHaveValue('2')
  expect(screen.getByTestId('totale').textContent).toMatch(/16,00/)
  await userEvent.click(screen.getByRole('button', { name: /Segnaposto nome · 2,50/ }))
  expect(screen.getByLabelText('Prodotto 2')).toHaveValue('Segnaposto nome')
  expect(screen.getByTestId('totale').textContent).toMatch(/18,50/)
})

it('un prodotto con testo personalizzato resta una riga a parte', async () => {
  apri()
  const candela = screen.getByRole('button', { name: /Candela grande · 8,00/ })
  await userEvent.click(candela)
  await userEvent.type(screen.getByLabelText('Testo personalizzato 1'), 'Mario')
  await userEvent.click(candela)
  expect(screen.getByLabelText('Prodotto 2')).toHaveValue('Candela grande')
  expect(screen.getByLabelText('Quantità 1')).toHaveValue('1')
})

it('nel nuovo ordine compaiono solo i Prodotti in uso con un prezzo, non i Materiali', () => {
  apri()
  expect(screen.getByRole('button', { name: /Candela grande/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Cera di soia/ })).not.toBeInTheDocument() // materiale
  expect(screen.queryByRole('button', { name: /Vecchio prodotto/ })).not.toBeInTheDocument() // disattivato
  expect(screen.queryByRole('button', { name: /Prodotto senza prezzo/ })).not.toBeInTheDocument()
})

it('un prodotto non venduto a pezzi non si propone (le quantità dell\'ordine sono intere)', () => {
  apri()
  expect(screen.queryByRole('button', { name: /Nastro raso/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Candela grande · 8,00 €$/ })).toBeInTheDocument()
})

it('la ricerca dei prodotti filtra e non mostra i prodotti disattivati', async () => {
  apri()
  expect(screen.queryByRole('button', { name: /Vecchio prodotto/ })).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Cerca un prodotto'), 'SEGNA')
  expect(screen.getByRole('button', { name: /Segnaposto nome/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Candela grande/ })).not.toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('Cerca un prodotto'))
  await userEvent.type(screen.getByLabelText('Cerca un prodotto'), 'zzz')
  expect(screen.getByText('Nessun prodotto corrisponde.')).toBeInTheDocument()
})

it('riga compilata a metà blocca il salvataggio', async () => {
  apri()
  await scegliCliente()
  await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Segnaposto')
  await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
  expect(await screen.findByText(/almeno un prodotto/)).toBeInTheDocument()
  expect(h.crea).not.toHaveBeenCalled()
})

it('il percorso in alto riporta all\'elenco ordini', () => {
  apri()
  const percorso = screen.getByRole('navigation', { name: 'Percorso' })
  expect(percorso).toHaveTextContent('Ordini')
  expect(screen.getByRole('link', { name: 'Ordini' })).toHaveAttribute('href', '/ordini')
  expect(percorso.querySelector('[aria-current="page"]')).toHaveTextContent('Nuovo ordine')
})
