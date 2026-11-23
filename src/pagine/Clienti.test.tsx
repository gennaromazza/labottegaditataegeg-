import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Clienti from './Clienti'
import ClienteScheda from './ClienteScheda'
import { ordineDiProva } from '../lib/fixture'
import type { Cliente } from '../lib/tipi'

const h = vi.hoisted(() => ({
  clienti: [] as Cliente[],
  aggiorna: vi.fn(),
  crea: vi.fn(),
}))

vi.mock('../data/clienti', () => ({
  ascoltaClienti: (cb: (c: Cliente[]) => void) => {
    cb(h.clienti)
    return () => {}
  },
  ascoltaCliente: (id: string, cb: (c: Cliente | null) => void) => {
    cb(h.clienti.find((c) => c.id === id) ?? null)
    return () => {}
  },
  aggiornaCliente: (...a: unknown[]) => h.aggiorna(...a),
  creaCliente: (...a: unknown[]) => h.crea(...a),
}))
vi.mock('../data/ordini', () => ({
  ascoltaOrdini: (cb: (o: unknown[]) => void) => {
    cb([
      ordineDiProva({ pagamenti: [{ importoCent: 500, data: '2026-11-05' }] }),
      ordineDiProva({ id: 'o2', numero: 8, clienteId: 'altro' }),
    ])
    return () => {}
  },
}))

beforeEach(() => {
  h.clienti = [
    { id: 'c1', nome: 'Maria Rossi', telefono: '333 1234567' },
    { id: 'c2', nome: 'Luca Bianchi' },
  ]
  h.aggiorna.mockReset()
  h.crea.mockReset()
})

function scheda() {
  return render(
    <MemoryRouter initialEntries={['/clienti/c1']}>
      <Routes>
        <Route path="/clienti/:id" element={<ClienteScheda />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('la ricerca "mar" filtra Maria Rossi', async () => {
  render(
    <MemoryRouter>
      <Clienti />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Cerca'), 'mar')
  expect(screen.getByText('Maria Rossi')).toBeInTheDocument()
  expect(screen.queryByText('Luca Bianchi')).not.toBeInTheDocument()
})

it('la scheda mostra storico ordini e totale incassato', () => {
  scheda()
  expect(screen.getByText('Ordine n. 7')).toBeInTheDocument()
  expect(screen.queryByText('Ordine n. 8')).not.toBeInTheDocument()
  expect(screen.getByText(/5,00/)).toBeInTheDocument()
})

it('salva i dati di spedizione validi', async () => {
  scheda()
  await userEvent.type(screen.getByLabelText('Destinatario (se diverso dal cliente)'), 'Anna Rossi')
  await userEvent.type(screen.getByLabelText('Indirizzo'), 'Via Roma 1')
  await userEvent.type(screen.getByLabelText('CAP'), '81031')
  await userEvent.type(screen.getByLabelText('Città'), 'Aversa')
  await userEvent.type(screen.getByLabelText('Provincia'), 'ce')
  await userEvent.click(screen.getByRole('button', { name: 'Salva spedizione' }))
  expect(h.aggiorna).toHaveBeenCalledWith('c1', {
    spedizione: { destinatario: 'Anna Rossi', indirizzo: 'Via Roma 1', cap: '81031', citta: 'Aversa', provincia: 'CE' },
  })
  expect(await screen.findByText('Dati di spedizione salvati')).toBeInTheDocument()
})

it('CAP o provincia non validi non salvano', async () => {
  scheda()
  await userEvent.type(screen.getByLabelText('Indirizzo'), 'Via Roma 1')
  await userEvent.type(screen.getByLabelText('Città'), 'Aversa')
  await userEvent.type(screen.getByLabelText('CAP'), '123')
  await userEvent.type(screen.getByLabelText('Provincia'), 'CE')
  await userEvent.click(screen.getByRole('button', { name: 'Salva spedizione' }))
  expect(await screen.findByText('Il CAP deve avere 5 cifre')).toBeInTheDocument()
  expect(h.aggiorna).not.toHaveBeenCalled()
})

it('mostra la spedizione già salvata', () => {
  h.clienti[0].spedizione = { indirizzo: 'Via Napoli 9', cap: '80100', citta: 'Napoli', provincia: 'NA' }
  scheda()
  expect(screen.getByLabelText('Indirizzo')).toHaveValue('Via Napoli 9')
})
