import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Spese from './Spese'

const h = vi.hoisted(() => ({ crea: vi.fn(), elimina: vi.fn() }))

vi.mock('../data/ordini', () => ({
  ascoltaOrdini: (cb: (o: unknown[]) => void) => {
    cb([
      { id: 'a', creatoIl: '2026-11-03', stato: 'confermato', righe: [], pagamenti: [], costoSpedizioneCent: 590 },
      { id: 'b', creatoIl: '2026-11-04', stato: 'annullato', righe: [], pagamenti: [], costoSpedizioneCent: 900 },
      { id: 'c', creatoIl: '2026-11-05', stato: 'pronto', righe: [], pagamenti: [] },
      { id: 'd', creatoIl: '2026-10-01', stato: 'pronto', righe: [], pagamenti: [], costoSpedizioneCent: 700 },
    ])
    return () => {}
  },
}))
vi.mock('../data/spese', () => ({
  ascoltaSpese: (cb: (s: unknown[]) => void) => {
    cb([
      { id: 's1', descrizione: 'Corriere GLS', importoCent: 590, data: '2026-11-05', categoria: 'Spedizioni' },
      { id: 's2', descrizione: 'Cera di soia', importoCent: 2000, data: '2026-11-10', categoria: 'Materiali' },
      { id: 's3', descrizione: 'Corriere BRT', importoCent: 700, data: '2026-12-01', categoria: 'Spedizioni' },
    ])
    return () => {}
  },
  creaSpesa: (...a: unknown[]) => h.crea(...a),
  eliminaSpesa: (...a: unknown[]) => h.elimina(...a),
}))

function apri(percorso = '/spese') {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <Spese />
    </MemoryRouter>,
  )
}

it('arrivando da una spedizione il modulo è già compilato', () => {
  apri('/spese?categoria=Spedizioni&descrizione=Spedizione%20ordine%20n.%207')
  expect(screen.getByLabelText('Cosa hai pagato')).toHaveValue('Spedizione ordine n. 7')
  expect(screen.getByLabelText('Categoria', { selector: '#sp-cat' })).toHaveValue('Spedizioni')
})

it('una categoria sconosciuta nel link non rompe il modulo', () => {
  apri('/spese?categoria=Boh')
  expect(screen.getByLabelText('Categoria', { selector: '#sp-cat' })).toHaveValue('Materiali')
})

function periodo(da: string, a: string) {
  fireEvent.change(screen.getByLabelText('Dal'), { target: { value: da } })
  fireEvent.change(screen.getByLabelText('Al'), { target: { value: a } })
}

beforeEach(() => {
  h.crea.mockReset()
  h.elimina.mockReset()
  h.crea.mockResolvedValue(undefined)
  h.elimina.mockResolvedValue(undefined)
})

it('totale spese e totale spedizioni del periodo', () => {
  apri()
  periodo('2026-11-01', '2026-11-30')
  expect(screen.getByTestId('totale-spese').textContent).toMatch(/25,90/)
  expect(screen.getByTestId('totale-spedizioni').textContent).toMatch(/5,90/)
  periodo('2026-11-01', '2026-12-31')
  expect(screen.getByTestId('totale-spedizioni').textContent).toMatch(/12,90/)
})

it('il filtro per categoria restringe l\'elenco ma non il totale delle spedizioni', async () => {
  apri()
  periodo('2026-11-01', '2026-12-31')
  await userEvent.selectOptions(screen.getByLabelText('Categoria', { selector: '#spe-cat' }), 'Spedizioni')
  expect(screen.getByText('Corriere GLS')).toBeInTheDocument()
  expect(screen.queryByText('Cera di soia')).not.toBeInTheDocument()
  expect(screen.getByTestId('totale-spedizioni').textContent).toMatch(/12,90/)
})

it('registra una nuova spesa', async () => {
  apri()
  await userEvent.type(screen.getByLabelText('Cosa hai pagato'), 'Scatole')
  await userEvent.type(screen.getByLabelText('Importo (€)'), '12,50')
  await userEvent.selectOptions(screen.getByLabelText('Categoria', { selector: '#sp-cat' }), 'Imballaggi')
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi spesa' }))
  expect(h.crea).toHaveBeenCalledWith(
    expect.objectContaining({ descrizione: 'Scatole', importoCent: 1250, categoria: 'Imballaggi', data: expect.any(String) }),
  )
})

it('descrizione o importo mancanti non salvano', async () => {
  apri()
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi spesa' }))
  expect(await screen.findByText('Scrivi cosa hai pagato')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Cosa hai pagato'), 'Scatole')
  await userEvent.type(screen.getByLabelText('Importo (€)'), 'abc')
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi spesa' }))
  expect(await screen.findByText('Scrivi un importo valido')).toBeInTheDocument()
  expect(h.crea).not.toHaveBeenCalled()
})

it('elimina solo dopo la conferma', async () => {
  apri()
  periodo('2026-11-01', '2026-11-30')
  const conferma = vi.spyOn(window, 'confirm')
  conferma.mockReturnValueOnce(false)
  await userEvent.click(screen.getByRole('button', { name: 'Elimina spesa Corriere GLS' }))
  expect(h.elimina).not.toHaveBeenCalled()
  conferma.mockReturnValueOnce(true)
  await userEvent.click(screen.getByRole('button', { name: 'Elimina spesa Corriere GLS' }))
  expect(h.elimina).toHaveBeenCalledWith('s1')
})

it('mostra le spedizioni addebitate ai clienti nel periodo, senza gli ordini annullati', () => {
  apri()
  periodo('2026-11-01', '2026-11-30')
  expect(screen.getByTestId('spedizioni-clienti').textContent).toMatch(/5,90/)
  periodo('2026-10-01', '2026-11-30')
  expect(screen.getByTestId('spedizioni-clienti').textContent).toMatch(/12,90/)
})
