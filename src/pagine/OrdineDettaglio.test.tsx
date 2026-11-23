import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OrdineDettaglio from './OrdineDettaglio'
import { ordineDiProva } from '../lib/fixture'
import { ErroreRegola } from '../lib/stati'
import type { Ordine, Pagamento } from '../lib/tipi'

const h = vi.hoisted(() => ({
  ordine: null as unknown as Ordine,
  cb: null as null | ((o: Ordine) => void),
  cliente: null as null | { id: string; nome: string; telefono?: string },
  rimuovi: vi.fn(),
  elimina: vi.fn(),
  aggiorna: vi.fn(),
  tutti: [] as Ordine[],
}))

vi.mock('../data/clienti', () => ({
  ascoltaCliente: (_id: string, cb: (c: unknown) => void) => {
    cb(h.cliente)
    return () => {}
  },
}))

vi.mock('../data/ordini', () => ({
  ascoltaOrdini: (cb: (o: Ordine[]) => void) => {
    cb(h.tutti)
    return () => {}
  },
  ascoltaOrdine: (_id: string, cb: (o: Ordine) => void) => {
    h.cb = cb
    cb(h.ordine)
    return () => {}
  },
  aggiornaOrdine: (...a: unknown[]) => h.aggiorna(...a),
  rimuoviPagamento: (...a: unknown[]) => h.rimuovi(...a),
  eliminaOrdine: (...a: unknown[]) => h.elimina(...a),
  aggiungiPagamento: async (_id: string, p: Pagamento) => {
    h.ordine = { ...h.ordine, pagamenti: [...h.ordine.pagamenti, p] }
    h.cb?.(h.ordine)
  },
}))

beforeEach(() => {
  h.cliente = null
})

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

it('il telefono aggiunto dopo nella scheda cliente abilita WhatsApp', () => {
  h.ordine = ordineDiProva({ clienteTelefono: undefined })
  h.cliente = { id: 'c1', nome: 'Maria Rossi', telefono: '333 7654321' }
  apri()
  const a = screen.getByRole('link', { name: 'Invia su WhatsApp' })
  expect(a.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/393337654321\?text=/)
})

it('annullato senza pagamenti non mostra residuo né badge di pagamento', () => {
  h.ordine = ordineDiProva({ stato: 'annullato' })
  apri()
  expect(screen.queryByText('Da saldare')).not.toBeInTheDocument()
  expect(screen.queryByText('Non pagato')).not.toBeInTheDocument()
})

it('rimuove il pagamento scelto (non per posizione) solo dopo la conferma', async () => {
  h.rimuovi.mockReset()
  h.rimuovi.mockResolvedValue(undefined)
  const p1 = { importoCent: 500, data: '2026-11-05' }
  const p2 = { importoCent: 300, data: '2026-11-20', metodo: 'contanti' as const }
  h.ordine = ordineDiProva({ pagamenti: [p1, p2] })
  apri()
  const conferma = vi.spyOn(window, 'confirm')
  conferma.mockReturnValueOnce(false)
  await userEvent.click(screen.getByRole('button', { name: 'Rimuovi pagamento 2' }))
  expect(h.rimuovi).not.toHaveBeenCalled()
  conferma.mockReturnValueOnce(true)
  await userEvent.click(screen.getByRole('button', { name: 'Rimuovi pagamento 2' }))
  expect(h.rimuovi).toHaveBeenCalledWith('o1', p2)
})

it('elimina l\'ordine solo dopo la conferma, avvisando dei pagamenti che spariscono', async () => {
  h.elimina.mockReset()
  h.elimina.mockResolvedValue(undefined)
  h.ordine = ordineDiProva({ pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
  apri()
  const conferma = vi.spyOn(window, 'confirm')
  conferma.mockReturnValueOnce(false)
  await userEvent.click(screen.getByRole('button', { name: 'Altre azioni' }))
  await userEvent.click(screen.getByRole('button', { name: 'Elimina ordine' }))
  expect(h.elimina).not.toHaveBeenCalled()
  conferma.mockReturnValueOnce(true)
  await userEvent.click(screen.getByRole('button', { name: 'Elimina ordine' }))
  expect(conferma).toHaveBeenLastCalledWith(expect.stringContaining('5,00'))
  expect(h.elimina).toHaveBeenCalledWith('o1')
})

it('se l\'eliminazione fallisce si vede un errore e l\'ordine resta', async () => {
  h.elimina.mockReset()
  h.elimina.mockImplementation(async () => {
    throw new Error('offline')
  })
  h.ordine = ordineDiProva()
  apri()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await userEvent.click(screen.getByRole('button', { name: 'Altre azioni' }))
  await userEvent.click(screen.getByRole('button', { name: 'Elimina ordine' }))
  expect(await screen.findByText(/Non sono riuscito a salvare/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Ordine n. 7' })).toBeInTheDocument()
})

describe('stati: senza acconto non si procede', () => {
  beforeEach(() => {
    h.aggiorna.mockReset()
    h.aggiorna.mockResolvedValue(undefined)
  })

  it('un ordine senza pagamenti non può andare in preparazione', async () => {
    h.ordine = ordineDiProva()
    apri()
    await userEvent.selectOptions(screen.getByLabelText("Stato dell'ordine"), 'in preparazione')
    expect(await screen.findByText(/Senza un acconto non si procede/, { selector: '[role="alert"]' })).toBeInTheDocument()
    expect(h.aggiorna).not.toHaveBeenCalled()
  })

  it('con un acconto si può passare a in preparazione', async () => {
    h.ordine = ordineDiProva({ stato: 'confermato', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
    apri()
    await userEvent.selectOptions(screen.getByLabelText("Stato dell'ordine"), 'in preparazione')
    expect(h.aggiorna).toHaveBeenCalledWith('o1', { stato: 'in preparazione' })
  })

  it('impostando "spedito" si registra anche la data di spedizione', async () => {
    h.ordine = ordineDiProva({ stato: 'pronto', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
    apri()
    await userEvent.selectOptions(screen.getByLabelText("Stato dell'ordine"), 'spedito')
    expect(h.aggiorna).toHaveBeenCalledWith('o1', { stato: 'spedito', dataSpedizione: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  })

  it('annullare si può anche senza acconto', async () => {
    h.ordine = ordineDiProva()
    apri()
    await userEvent.selectOptions(screen.getByLabelText("Stato dell'ordine"), 'annullato')
    expect(h.aggiorna).toHaveBeenCalledWith('o1', { stato: 'annullato' })
  })

  it('un ordine in attesa mostra l\'avviso, senza pulsanti per avanzare', () => {
    h.ordine = ordineDiProva()
    apri()
    expect(screen.getByText(/non si procede/i, { selector: '.avviso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Inizia la preparazione|Conferma ordine/ })).not.toBeInTheDocument()
  })

  it('l\'etichetta dello stato è in italiano corrente', () => {
    h.ordine = ordineDiProva({ stato: 'pronto', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
    apri()
    expect(screen.getAllByText('Pronto da spedire').length).toBeGreaterThan(0)
  })

  it('un ordine pronto mostra il pannello di spedizione e un link alle Spedizioni', () => {
    h.ordine = ordineDiProva({ stato: 'pronto', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
    apri()
    expect(screen.getByRole('button', { name: 'Segna come spedito' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nelle Spedizioni' })).toHaveAttribute('href', '/spedizioni')
  })

  it('senza indirizzo di spedizione rimanda alla scheda cliente, con l\'indirizzo lo mostra', () => {
    h.ordine = ordineDiProva()
    apri()
    expect(screen.getByRole('link', { name: /Aggiungilo nella scheda cliente/ })).toHaveAttribute('href', '/clienti/c1?apri=spedizione')
  })
})

it('con l\'indirizzo del cliente lo mostra', () => {
  h.ordine = ordineDiProva()
  h.cliente = {
    id: 'c1',
    nome: 'Maria Rossi',
    telefono: '333 1234567',
    spedizione: { indirizzo: 'Via Roma 1', cap: '81031', citta: 'Aversa', provincia: 'CE' },
  } as never
  apri()
  expect(screen.getByText(/Spedizione a: Via Roma 1, 81031 Aversa \(CE\)/)).toBeInTheDocument()
})

it('se togliere il pagamento viola la regola dell\'acconto, il motivo si vede così com\'è', async () => {
  h.rimuovi.mockReset()
  h.rimuovi.mockImplementation(async () => {
    throw new ErroreRegola('Questo è l\'unico pagamento e l\'ordine è già avanti. Prima cambia lo stato.')
  })
  h.ordine = ordineDiProva({ stato: 'in preparazione', pagamenti: [{ importoCent: 500, data: '2026-11-05' }] })
  apri()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await userEvent.click(screen.getByRole('button', { name: 'Rimuovi pagamento 1' }))
  expect(await screen.findByText(/unico pagamento e l'ordine è già avanti/)).toBeInTheDocument()
  expect(screen.queryByText(/Non sono riuscito a salvare/)).not.toBeInTheDocument()
})

it('mostra il link dell\'ordine e lo copia', async () => {
  const user = userEvent.setup()
  h.ordine = ordineDiProva()
  apri()
  expect(screen.queryByRole('button', { name: 'Copia link' })).not.toBeInTheDocument() // sezione chiusa all'inizio
  await user.click(screen.getByRole('button', { name: "Link dell'ordine" }))
  expect(screen.getByLabelText('Si apre solo dopo il login')).toHaveValue(`${window.location.origin}/ordini/o1`)
  await user.click(screen.getByRole('button', { name: 'Copia link' }))
  expect(await screen.findByText('Link copiato')).toBeInTheDocument()
  expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/ordini/o1`)
})

it('il pulsante Stampa apre la stampa del browser', async () => {
  const stampa = vi.fn()
  window.print = stampa
  h.ordine = ordineDiProva()
  apri()
  await userEvent.click(screen.getByRole('button', { name: 'Stampa' }))
  expect(stampa).toHaveBeenCalledTimes(1)
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

describe('collegamenti e organizzazione della pagina', () => {
  const pagato = [{ importoCent: 500, data: '2026-11-05' }]

  it('il percorso porta all\'elenco ordini e alla scheda del cliente', () => {
    h.ordine = ordineDiProva({ pagamenti: pagato, stato: 'confermato' })
    apri()
    const percorso = screen.getByRole('navigation', { name: 'Percorso' })
    expect(percorso).toHaveTextContent('Ordini')
    expect(within(percorso).getByRole('link', { name: 'Ordini' })).toHaveAttribute('href', '/ordini')
    expect(within(percorso).getByRole('link', { name: 'Maria Rossi' })).toHaveAttribute('href', '/clienti/c1')
    expect(percorso.querySelector('[aria-current="page"]')).toHaveTextContent('n. 7')
  })

  it('le scorciatoie portano alla scheda del cliente, ai suoi ordini e a un nuovo ordine per lui', () => {
    h.ordine = ordineDiProva({ pagamenti: pagato, stato: 'confermato' })
    apri()
    const s = screen.getByLabelText('Scorciatoie')
    expect(within(s).getByRole('link', { name: 'Scheda cliente' })).toHaveAttribute('href', '/clienti/c1')
    expect(within(s).getByRole('link', { name: 'Altri ordini di Maria Rossi' })).toHaveAttribute('href', '/ordini?cliente=c1')
    expect(within(s).getByRole('link', { name: '+ Nuovo ordine per Maria Rossi' })).toHaveAttribute('href', '/ordini/nuovo?cliente=c1')
  })

  it.each([
    ['confermato', '/spedizioni'],
    ['pronto', '/spedizioni'],
    ['spedito', '/spedizioni?vista=spediti'],
    ['consegnato', '/spedizioni?vista=consegnati'],
  ] as const)('"Nelle Spedizioni" per un ordine %s apre la vista giusta', (stato, href) => {
    h.ordine = ordineDiProva({ stato, pagamenti: pagato })
    apri()
    expect(screen.getByRole('link', { name: 'Nelle Spedizioni' })).toHaveAttribute('href', href)
  })

  it('un ordine in attesa di acconto rimanda alla vista "in attesa"', () => {
    h.ordine = ordineDiProva()
    apri()
    expect(screen.getByRole('link', { name: 'Nelle Spedizioni' })).toHaveAttribute('href', '/spedizioni?vista=attesa')
  })

  it('ordine precedente e successivo, per scorrere senza tornare all\'elenco', () => {
    h.ordine = ordineDiProva({ id: 'o1', numero: 7, stato: 'confermato', pagamenti: pagato })
    h.tutti = [
      ordineDiProva({ id: 'o5', numero: 5, clienteNome: 'Luca Bianchi' }),
      ordineDiProva({ id: 'o6', numero: 6, clienteNome: 'Anna Verdi' }),
      ordineDiProva({ id: 'o1', numero: 7 }),
      ordineDiProva({ id: 'o8', numero: 8, clienteNome: 'Paolo Neri' }),
      ordineDiProva({ id: 'o9', numero: 9, clienteNome: 'Sara Blu' }),
    ]
    apri()
    const nav = screen.getByRole('navigation', { name: 'Altri ordini' })
    expect(within(nav).getByRole('link', { name: '← n. 6 · Anna Verdi' })).toHaveAttribute('href', '/ordini/o6')
    expect(within(nav).getByRole('link', { name: 'n. 8 · Paolo Neri →' })).toHaveAttribute('href', '/ordini/o8')
    expect(within(nav).getAllByRole('link')).toHaveLength(2)
  })

  it('il primo ordine non ha il precedente, l\'ultimo non ha il successivo', () => {
    h.ordine = ordineDiProva({ id: 'o1', numero: 1, stato: 'confermato', pagamenti: pagato })
    h.tutti = [ordineDiProva({ id: 'o1', numero: 1 }), ordineDiProva({ id: 'o2', numero: 2, clienteNome: 'Luca Bianchi' })]
    apri()
    const nav = screen.getByRole('navigation', { name: 'Altri ordini' })
    expect(within(nav).getAllByRole('link')).toHaveLength(1)
    expect(within(nav).getByRole('link', { name: /n\. 2/ })).toBeInTheDocument()
  })

  it('un ordine solo non mostra la navigazione tra ordini', () => {
    h.ordine = ordineDiProva({ id: 'o1', numero: 1, stato: 'confermato', pagamenti: pagato })
    h.tutti = [ordineDiProva({ id: 'o1', numero: 1 })]
    apri()
    expect(screen.queryByRole('navigation', { name: 'Altri ordini' })).not.toBeInTheDocument()
  })

  it('le sezioni: Pagamenti aperta, Link e Altre azioni chiuse', () => {
    h.ordine = ordineDiProva({ stato: 'confermato', pagamenti: pagato })
    apri()
    expect(screen.getByRole('button', { name: 'Pagamenti (1)' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: "Link dell'ordine" })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Altre azioni' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Elimina ordine' })).not.toBeInTheDocument()
  })

  it('il menu dello stato non propone "In attesa di acconto" se c\'è già un acconto', () => {
    h.ordine = ordineDiProva({ stato: 'confermato', pagamenti: pagato })
    apri()
    const opzioni = within(screen.getByLabelText("Stato dell'ordine")).getAllByRole('option').map((o) => o.textContent)
    expect(opzioni).not.toContain('In attesa di acconto')
    expect(opzioni).toContain('Confermato')
    expect(opzioni).toContain('Annullato')
  })

  it('senza acconto lo stato è "In attesa di acconto" e il menu non resta vuoto', () => {
    h.ordine = ordineDiProva()
    apri()
    const menu = screen.getByLabelText("Stato dell'ordine")
    expect(menu).toHaveValue('in attesa acconto')
    expect(within(menu).getAllByRole('option').map((o) => o.textContent)).toContain('In attesa di acconto')
  })
})
