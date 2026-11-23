import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Ordini from './Ordini'
import { ordineDiProva } from '../lib/fixture'
import type { Ordine } from '../lib/tipi'

const h = vi.hoisted(() => ({ ordini: [] as Ordine[] }))

vi.mock('../data/ordini', () => ({
  ascoltaOrdini: (cb: (o: Ordine[]) => void) => {
    cb(h.ordini)
    return () => {}
  },
}))

const pagato = [{ importoCent: 1750, data: '2026-11-05' }]

beforeEach(() => {
  h.ordini = [
    ordineDiProva({ id: 'o1', numero: 1, clienteId: 'c1', clienteNome: 'Maria Rossi', stato: 'pronto', canale: 'WhatsApp' }),
    ordineDiProva({ id: 'o2', numero: 2, clienteId: 'c2', clienteNome: 'Luca Bianchi', stato: 'confermato', canale: 'TikTok' }),
    ordineDiProva({ id: 'o3', numero: 3, clienteId: 'c3', clienteNome: 'Anna Verdi', stato: 'in attesa acconto', canale: 'Instagram' }),
    ordineDiProva({ id: 'o4', numero: 4, clienteId: 'c1', clienteNome: 'Maria Rossi', stato: 'spedito', pagamenti: pagato }),
    ordineDiProva({ id: 'o5', numero: 5, clienteId: 'c5', clienteNome: 'Paolo Neri', stato: 'annullato' }),
    ordineDiProva({ id: 'o6', numero: 6, clienteId: 'c1', clienteNome: 'Maria Rossi', stato: 'consegnato', pagamenti: pagato }),
  ]
})

const apri = (percorso = '/ordini') =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <Ordini />
    </MemoryRouter>,
  )

const numeri = () => screen.queryAllByText(/^n\. \d+/).map((e) => e.textContent!.match(/^n\. (\d+)/)![1])

describe('scorciatoie con contatori', () => {
  it('mostra quanti ordini ci sono in ogni vista', () => {
    apri()
    expect(screen.getByRole('button', { name: 'Tutti (6)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Da incassare (3)' })).toBeInTheDocument() // o1, o2, o3 (gli annullati non contano)
    expect(screen.getByRole('button', { name: 'In attesa di acconto (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spediti (1)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Da lavorare (2) →' })).toHaveAttribute('href', '/spedizioni')
  })

  it('toccando una scorciatoia la lista si filtra e il pulsante risulta premuto', async () => {
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Da incassare (3)' }))
    expect(numeri()).toEqual(['1', '2', '3'])
    expect(screen.getByRole('button', { name: 'Da incassare (3)' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Spediti (1)' }))
    expect(numeri()).toEqual(['4'])
    await userEvent.click(screen.getByRole('button', { name: 'In attesa di acconto (1)' }))
    expect(numeri()).toEqual(['3'])
    await userEvent.click(screen.getByRole('button', { name: 'Tutti (6)' }))
    expect(numeri()).toHaveLength(6)
  })

  it('il conteggio dice quanti ordini si vedono su quanti ce ne sono', async () => {
    apri()
    expect(screen.getByText('6 ordini')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Spediti (1)' }))
    expect(screen.getByText('1 ordine su 6')).toBeInTheDocument()
  })
})

describe('ricerca', () => {
  it('per cliente, senza badare a maiuscole', async () => {
    apri()
    await userEvent.type(screen.getByLabelText('Cerca per cliente o numero'), 'MARIA')
    expect(numeri()).toEqual(['1', '4', '6'])
  })

  it('per numero, anche scritto "n. 2"', async () => {
    apri()
    const campo = screen.getByLabelText('Cerca per cliente o numero')
    await userEvent.type(campo, 'n. 2')
    expect(numeri()).toEqual(['2'])
    await userEvent.clear(campo)
    await userEvent.type(campo, '5')
    expect(numeri()).toEqual(['5'])
  })

  it('insieme a una scorciatoia', async () => {
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Da incassare (3)' }))
    await userEvent.type(screen.getByLabelText('Cerca per cliente o numero'), 'maria')
    expect(numeri()).toEqual(['1'])
  })

  it('nessun risultato', async () => {
    apri()
    await userEvent.type(screen.getByLabelText('Cerca per cliente o numero'), 'zzz')
    expect(screen.getByText('Nessun ordine.')).toBeInTheDocument()
  })
})

describe('altri filtri a scomparsa', () => {
  it('chiusi all\'inizio, per non occupare la schermata', () => {
    apri()
    expect(screen.queryByLabelText('Canale')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Altri filtri' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('aprendoli si filtra per stato e canale', async () => {
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Altri filtri' }))
    await userEvent.selectOptions(screen.getByLabelText('Stato'), 'pronto')
    expect(numeri()).toEqual(['1'])
    await userEvent.selectOptions(screen.getByLabelText('Stato'), '')
    await userEvent.selectOptions(screen.getByLabelText('Canale'), 'TikTok')
    expect(numeri()).toEqual(['2'])
  })

  it('si aprono da soli se c\'è un filtro attivo, così si vede perché la lista è corta', () => {
    apri('/ordini?canale=TikTok')
    expect(screen.getByLabelText('Canale')).toHaveValue('TikTok')
    expect(numeri()).toEqual(['2'])
  })
})

describe('filtri collegabili dall\'indirizzo', () => {
  it('?stato= parte già filtrato', () => {
    apri('/ordini?stato=pronto')
    expect(screen.getByLabelText('Stato')).toHaveValue('pronto')
    expect(numeri()).toEqual(['1'])
  })

  it('?pagamento=da-incassare', () => {
    apri('/ordini?pagamento=da-incassare')
    expect(screen.getByLabelText('Pagamento')).toHaveValue('da-incassare')
    expect(screen.getByRole('button', { name: 'Da incassare (3)' })).toHaveAttribute('aria-pressed', 'true')
    expect(numeri()).toEqual(['1', '2', '3'])
  })

  it('?pagamento=saldati non mostra i non pagati né gli annullati', () => {
    apri('/ordini?pagamento=saldati')
    expect(numeri()).toEqual(['4', '6'])
  })

  it('valori sconosciuti vengono ignorati', () => {
    apri('/ordini?stato=boh&pagamento=boh&canale=boh')
    expect(numeri()).toHaveLength(6)
  })

  it('?cliente= mostra solo gli ordini di quel cliente, con un avviso e il modo di tornare a tutti', () => {
    apri('/ordini?cliente=c1')
    expect(numeri()).toEqual(['1', '4', '6'])
    expect(screen.getByRole('status')).toHaveTextContent('Solo gli ordini di Maria Rossi')
    expect(screen.getByRole('link', { name: 'Mostra tutti' })).toHaveAttribute('href', '/ordini')
    expect(screen.getByRole('link', { name: 'Apri la scheda' })).toHaveAttribute('href', '/clienti/c1')
  })

  it('con ?cliente= i contatori contano solo quel cliente', () => {
    apri('/ordini?cliente=c1')
    expect(screen.getByRole('button', { name: 'Tutti (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spediti (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In attesa di acconto (0)' })).toBeInTheDocument()
  })

  it('una scorciatoia mantiene il cliente scelto', async () => {
    apri('/ordini?cliente=c1')
    await userEvent.click(screen.getByRole('button', { name: 'Spediti (1)' }))
    expect(numeri()).toEqual(['4'])
    expect(screen.getByRole('status')).toHaveTextContent('Maria Rossi')
  })
})

describe('con molti ordini', () => {
  it('mostra i primi 15 e "Mostra altri"', async () => {
    h.ordini = Array.from({ length: 40 }, (_, i) =>
      ordineDiProva({ id: `x${i}`, numero: 40 - i, clienteId: `k${i}`, clienteNome: `Cliente ${i}` }),
    )
    apri()
    expect(numeri()).toHaveLength(15)
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 15 (ne restano 25)' }))
    expect(numeri()).toHaveLength(30)
  })

  it('cambiando filtro si riparte dall\'inizio', async () => {
    h.ordini = Array.from({ length: 40 }, (_, i) =>
      ordineDiProva({ id: `x${i}`, numero: 40 - i, clienteId: `k${i}`, clienteNome: `Cliente ${i}` }),
    )
    apri()
    await userEvent.click(screen.getByRole('button', { name: /Mostra altri 15/ }))
    expect(numeri()).toHaveLength(30)
    await userEvent.type(screen.getByLabelText('Cerca per cliente o numero'), 'cliente')
    expect(numeri()).toHaveLength(15)
  })
})

it('Stampa elenco apre la stampa del browser', async () => {
  const stampa = vi.fn()
  window.print = stampa
  apri()
  await userEvent.click(screen.getByRole('button', { name: 'Stampa elenco' }))
  expect(stampa).toHaveBeenCalledTimes(1)
})

it('c\'è sempre il pulsante per un nuovo ordine', () => {
  apri()
  expect(screen.getByRole('link', { name: '+ Nuovo ordine' })).toHaveAttribute('href', '/ordini/nuovo')
})
