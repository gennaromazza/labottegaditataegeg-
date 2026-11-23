import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Clienti from './Clienti'
import ClienteScheda from './ClienteScheda'
import { ordineDiProva } from '../lib/fixture'
import type { Cliente, Ordine } from '../lib/tipi'

const h = vi.hoisted(() => ({
  clienti: [] as Cliente[],
  aggiorna: vi.fn(),
  crea: vi.fn(),
  elimina: vi.fn(),
  ordini: null as null | Ordine[],
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
    cb(
      h.ordini ?? [
        ordineDiProva({ pagamenti: [{ importoCent: 500, data: '2026-11-05' }] }),
        ordineDiProva({ id: 'o2', numero: 8, clienteId: 'altro' }),
      ],
    )
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
  h.ordini = null
})

/** Di solito la scheda si apre con il modulo di spedizione già aperto (come da collegamento ?apri=spedizione). */
function scheda(percorso = '/clienti/c1?apri=spedizione') {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <Routes>
        <Route path="/clienti/:id" element={<ClienteScheda />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('elenco clienti', () => {
  const elenco = () =>
    render(
      <MemoryRouter>
        <Clienti />
      </MemoryRouter>,
    )

  it('ogni cliente mostra quanti ordini ha e quanto resta da incassare', () => {
    elenco()
    const maria = screen.getByRole('link', { name: /Maria Rossi/ })
    expect(maria).toHaveTextContent('1 ordine · da incassare 12,50')
    expect(maria).toHaveAttribute('href', '/clienti/c1')
  })

  it('un cliente senza ordini non ha riepilogo', () => {
    elenco()
    expect(screen.getByRole('link', { name: /Luca Bianchi/ })).not.toHaveTextContent('ordin')
  })

  it('un cliente con tutto pagato mostra solo il numero degli ordini', () => {
    h.ordini = [
      ordineDiProva({ id: 'a', numero: 1, clienteId: 'c1', pagamenti: [{ importoCent: 1750, data: '2026-11-05' }] }),
      ordineDiProva({ id: 'b', numero: 2, clienteId: 'c1', pagamenti: [{ importoCent: 1750, data: '2026-11-06' }] }),
    ]
    elenco()
    const maria = screen.getByRole('link', { name: /Maria Rossi/ })
    expect(maria).toHaveTextContent('2 ordini')
    expect(maria).not.toHaveTextContent('da incassare')
  })

  it('un ordine annullato non conta tra i soldi da incassare', () => {
    h.ordini = [ordineDiProva({ id: 'a', numero: 1, clienteId: 'c1', stato: 'annullato' })]
    elenco()
    expect(screen.getByRole('link', { name: /Maria Rossi/ })).not.toHaveTextContent('da incassare')
  })

  it('dice quanti clienti si vedono su quanti ce ne sono', async () => {
    elenco()
    expect(screen.getByText('2 clienti')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Cerca'), 'luca')
    expect(screen.getByText('1 cliente su 2')).toBeInTheDocument()
  })

  it('la ricerca ignora accenti e maiuscole, e trova anche dal telefono (cifre)', async () => {
    h.clienti = [...h.clienti, { id: 'c3', nome: 'Nicolò Esposito', telefono: '+39 348 111 2222' }]
    elenco()
    await userEvent.type(screen.getByLabelText('Cerca'), 'NICOLO')
    expect(screen.getByRole('link', { name: /Nicolò Esposito/ })).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Cerca'))
    await userEvent.type(screen.getByLabelText('Cerca'), '348 111')
    expect(screen.getByRole('link', { name: /Nicolò Esposito/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Maria Rossi/ })).not.toBeInTheDocument()
  })

  it('con molti clienti mostra i primi 15 e "Mostra altri"', async () => {
    h.clienti = Array.from({ length: 40 }, (_, i) => ({ id: `k${i}`, nome: `Cliente ${String(i).padStart(2, '0')}` }))
    elenco()
    expect(screen.getAllByRole('link', { name: /^Cliente/ })).toHaveLength(15)
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 15 (ne restano 25)' }))
    expect(screen.getAllByRole('link', { name: /^Cliente/ })).toHaveLength(30)
  })

  it('nessun risultato', async () => {
    elenco()
    await userEvent.type(screen.getByLabelText('Cerca'), 'zzz')
    expect(screen.getByText('Nessun cliente trovato.')).toBeInTheDocument()
  })
})

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

describe('scheda cliente organizzata a sezioni', () => {
  it('gli ordini sono in una sezione aperta, con riepilogo, e ognuno si apre', () => {
    scheda()
    expect(screen.getByRole('button', { name: 'Ordini (1)' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Aperti:/).parentElement).toHaveTextContent('Incassato: 5,00')
    expect(screen.getByText(/Aperti:/).parentElement).toHaveTextContent('Da incassare: 12,50')
    expect(screen.getByRole('link', { name: /n\. 7/ })).toHaveAttribute('href', '/ordini/o1')
    expect(screen.queryByText(/n\. 8/)).not.toBeInTheDocument() // ordine di un altro cliente
  })

  it('il percorso in alto riporta all\'elenco dei clienti', () => {
    scheda()
    const percorso = screen.getByRole('navigation', { name: 'Percorso' })
    expect(percorso).toHaveTextContent('Clienti')
    expect(screen.getByRole('link', { name: 'Clienti' })).toHaveAttribute('href', '/clienti')
    expect(percorso.querySelector('[aria-current="page"]')).toHaveTextContent('Maria Rossi')
  })

  it('"Nuovo ordine" parte con il cliente già scelto', () => {
    scheda()
    expect(screen.getByRole('link', { name: '+ Nuovo ordine' })).toHaveAttribute('href', '/ordini/nuovo?cliente=c1')
  })

  it('scorciatoie: tutti i suoi ordini e quelli da incassare, già filtrati', () => {
    scheda()
    expect(screen.getByRole('link', { name: 'Tutti i suoi ordini (1)' })).toHaveAttribute('href', '/ordini?cliente=c1')
    expect(screen.getByRole('link', { name: /Da incassare: 12,50/ })).toHaveAttribute('href', '/ordini?cliente=c1&pagamento=da-incassare')
  })

  it('senza ordini niente scorciatoie inutili', () => {
    h.ordini = []
    scheda()
    expect(screen.queryByRole('link', { name: /Tutti i suoi ordini/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Da incassare/ })).not.toBeInTheDocument()
    expect(screen.getByText('Nessun ordine per questo cliente.')).toBeInTheDocument()
  })

  it('anagrafica e spedizione sono chiuse all\'inizio', () => {
    scheda('/clienti/c1')
    expect(screen.getByRole('button', { name: 'Anagrafica' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Dati di spedizione/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Indirizzo')).not.toBeInTheDocument()
  })

  it('?apri=spedizione apre direttamente il modulo, ?apri=anagrafica l\'altro', () => {
    scheda('/clienti/c1?apri=spedizione')
    expect(screen.getByLabelText('Indirizzo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Telefono')).not.toBeInTheDocument()
  })

  it('?apri=anagrafica', () => {
    scheda('/clienti/c1?apri=anagrafica')
    expect(screen.getByLabelText('Telefono')).toHaveValue('333 1234567')
    expect(screen.queryByLabelText('Indirizzo')).not.toBeInTheDocument()
  })

  it('il titolo dice se la spedizione è da compilare', () => {
    scheda('/clienti/c1')
    expect(screen.getByRole('button', { name: 'Dati di spedizione (da compilare)' })).toBeInTheDocument()
  })

  it('con la spedizione già compilata il titolo è pulito', () => {
    h.clienti[0].spedizione = { indirizzo: 'Via Napoli 9', cap: '80100', citta: 'Napoli', provincia: 'NA' }
    scheda('/clienti/c1')
    expect(screen.getByRole('button', { name: 'Dati di spedizione' })).toBeInTheDocument()
  })

  it('con molti ordini mostra i più recenti e "Mostra altri"', async () => {
    h.ordini = Array.from({ length: 25 }, (_, i) => ordineDiProva({ id: `x${i}`, numero: i + 1, clienteId: 'c1' }))
    scheda('/clienti/c1')
    expect(screen.getAllByRole('link', { name: /^n\. \d+/ })).toHaveLength(10)
    expect(screen.getByRole('link', { name: /^n\. 25/ })).toBeInTheDocument() // il più recente per primo
    expect(screen.queryByRole('link', { name: /^n\. 1 ·?/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 10 (ne restano 15)' }))
    expect(screen.getAllByRole('link', { name: /^n\. \d+/ })).toHaveLength(20)
  })
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
