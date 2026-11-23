import { render, screen, waitFor } from '@testing-library/react'
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
  elimina: vi.fn(),
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
  eliminaCliente: (...a: unknown[]) => h.elimina(...a),
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
  h.elimina.mockReset()
  h.elimina.mockResolvedValue(undefined)
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

it('la scheda mostra in alto gli ordini del cliente, apribili, con il riepilogo', () => {
  scheda()
  const sezione = screen.getByRole('region', { name: 'Ordini del cliente' })
  expect(sezione).toHaveTextContent('Ordini (1)')
  expect(sezione).toHaveTextContent('n. 7')
  expect(sezione).not.toHaveTextContent('n. 8') // ordine di un altro cliente
  expect(sezione).toHaveTextContent('Incassato: 5,00')
  expect(sezione).toHaveTextContent('Da incassare: 12,50')
  expect(screen.getByRole('link', { name: /n\. 7/ })).toHaveAttribute('href', '/ordini/o1')
})

it('"Nuovo ordine" parte con il cliente già scelto', () => {
  scheda()
  expect(screen.getByRole('link', { name: '+ Nuovo ordine' })).toHaveAttribute('href', '/ordini/nuovo?cliente=c1')
})

it('elimina il cliente solo dopo la conferma e avvisa degli ordini collegati', async () => {
  scheda()
  const conferma = vi.spyOn(window, 'confirm')
  conferma.mockReturnValueOnce(false)
  await userEvent.click(screen.getByRole('button', { name: 'Elimina cliente' }))
  expect(h.elimina).not.toHaveBeenCalled()
  conferma.mockReturnValueOnce(true)
  await userEvent.click(screen.getByRole('button', { name: 'Elimina cliente' }))
  expect(conferma).toHaveBeenLastCalledWith(expect.stringContaining('ordini collegati (1)'))
  expect(h.elimina).toHaveBeenCalledWith('c1')
})

it('salva i dati di spedizione validi', async () => {
  scheda()
  await userEvent.type(screen.getByLabelText('Destinatario (se diverso dal cliente)'), 'Anna Rossi')
  await userEvent.type(screen.getByLabelText('Indirizzo'), 'Via Roma 1')
  await userEvent.type(screen.getByLabelText('CAP'), '81031')
  // città e provincia si compilano da sole dal CAP
  await waitFor(() => expect(screen.getByLabelText('Città')).toHaveValue('Aversa'))
  expect(screen.getByLabelText('Provincia')).toHaveValue('CE')
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

it('scrivendo la città si suggeriscono comuni con provincia e CAP', async () => {
  scheda()
  await userEvent.type(screen.getByLabelText('Città'), 'avers')
  await userEvent.click(await screen.findByRole('option', { name: /^Aversa \(CE\)/ }))
  expect(screen.getByLabelText('Città')).toHaveValue('Aversa')
  expect(screen.getByLabelText('Provincia')).toHaveValue('CE')
  expect(screen.getByLabelText('CAP')).toHaveValue('81031')
})

it('una città con più CAP li propone nel campo CAP', async () => {
  scheda()
  await userEvent.type(screen.getByLabelText('Città'), 'napol')
  await userEvent.click(await screen.findByRole('option', { name: /^Napoli \(NA\)/ }))
  expect(screen.getByLabelText('CAP')).toHaveValue('')
  const opzioni = document.querySelectorAll('#cap-suggeriti option')
  expect(opzioni.length).toBeGreaterThan(5)
})

it('un CAP condiviso da più comuni chiede di scegliere', async () => {
  scheda()
  await userEvent.type(screen.getByLabelText('CAP'), '26834')
  const gruppo = await screen.findByRole('group', { name: 'Comuni con questo CAP' })
  expect(gruppo).toHaveTextContent('Abbadia Cerreto (LO)')
  await userEvent.click(screen.getByRole('button', { name: 'Corte Palasio (LO)' }))
  expect(screen.getByLabelText('Città')).toHaveValue('Corte Palasio')
  expect(screen.getByLabelText('Provincia')).toHaveValue('LO')
})

it('un CAP sconosciuto non compila nulla e si può scrivere a mano', async () => {
  scheda()
  await userEvent.type(screen.getByLabelText('CAP'), '00000')
  await userEvent.type(screen.getByLabelText('Città'), 'Posto Nuovo')
  expect(screen.getByLabelText('Città')).toHaveValue('Posto Nuovo')
  expect(screen.queryByRole('group', { name: 'Comuni con questo CAP' })).not.toBeInTheDocument()
})

it('mostra la spedizione già salvata', () => {
  h.clienti[0].spedizione = { indirizzo: 'Via Napoli 9', cap: '80100', citta: 'Napoli', provincia: 'NA' }
  scheda()
  expect(screen.getByLabelText('Indirizzo')).toHaveValue('Via Napoli 9')
})
