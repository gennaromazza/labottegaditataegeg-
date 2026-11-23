import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Spedizioni from './Spedizioni'
import { ordineDiProva } from '../lib/fixture'
import type { Cliente, Ordine } from '../lib/tipi'

const h = vi.hoisted(() => ({ ordini: [] as Ordine[], clienti: [] as Cliente[], aggiorna: vi.fn() }))

vi.mock('../data/ordini', () => ({
  ascoltaOrdini: (cb: (o: Ordine[]) => void) => {
    cb(h.ordini)
    return () => {}
  },
  aggiornaOrdine: (...a: unknown[]) => h.aggiorna(...a),
}))
vi.mock('../data/clienti', () => ({
  ascoltaClienti: (cb: (c: Cliente[]) => void) => {
    cb(h.clienti)
    return () => {}
  },
}))

const pag = [{ importoCent: 500, data: '2026-11-05' }]

beforeEach(() => {
  h.aggiorna.mockReset()
  h.aggiorna.mockResolvedValue(undefined)
  h.clienti = [
    {
      id: 'c1',
      nome: 'Maria Rossi',
      telefono: '333 1234567',
      spedizione: { destinatario: 'Anna Rossi', indirizzo: 'Via Roma 1', cap: '81031', citta: 'Aversa', provincia: 'CE' },
    },
  ]
  h.ordini = [
    ordineDiProva({ id: 'o1', numero: 1, stato: 'confermato', pagamenti: pag, dataConsegna: '2026-12-20' }),
    ordineDiProva({ id: 'o2', numero: 2, stato: 'in preparazione', pagamenti: pag, notePreparazione: 'colore rosso scelto' }),
    ordineDiProva({ id: 'o3', numero: 3, stato: 'pronto', pagamenti: pag }),
    ordineDiProva({ id: 'o4', numero: 4, stato: 'spedito', pagamenti: pag, corriere: 'GLS', tracking: 'AB123', dataSpedizione: '2026-11-20' }),
    ordineDiProva({ id: 'o5', numero: 5, stato: 'in attesa acconto' }),
    ordineDiProva({ id: 'o6', numero: 6, stato: 'consegnato', pagamenti: pag }),
  ]
})

const apri = (percorso = '/spedizioni') =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <Spedizioni />
    </MemoryRouter>,
  )

const vai = (nome: RegExp) => userEvent.click(screen.getByRole('button', { name: nome }))

describe('Da lavorare', () => {
  it('mostra solo confermati, in preparazione e pronti, con i conteggi sulle linguette', () => {
    apri()
    expect(screen.getByRole('button', { name: /Da lavorare \(3\)/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Spediti \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /In attesa di acconto \(1\)/ })).toBeInTheDocument()
    expect(screen.getByText(/n\. 1 ·/)).toBeInTheDocument()
    expect(screen.getByText(/n\. 2 ·/)).toBeInTheDocument()
    expect(screen.getByText(/n\. 3 ·/)).toBeInTheDocument()
    expect(screen.queryByText(/n\. 4 ·/)).not.toBeInTheDocument()
    expect(screen.queryByText(/n\. 5 ·/)).not.toBeInTheDocument()
  })

  it('i pronti vengono per primi, poi in preparazione, poi da preparare', () => {
    apri()
    const titoli = screen.getAllByRole('heading', { level: 2 }).map((t) => t.textContent)
    expect(titoli).toEqual(['Pronti da spedire (1)', 'In preparazione (1)', 'Da preparare (acconto ricevuto) (1)'])
  })

  it('mostra l\'indirizzo del cliente, o il modo per aggiungerlo', () => {
    h.clienti = []
    apri()
    expect(screen.getAllByText(/Indirizzo mancante/).length).toBe(3)
    expect(screen.getAllByRole('link', { name: /Aggiungilo nella scheda cliente/ })[0]).toHaveAttribute('href', '/clienti/c1')
  })

  it('con l\'indirizzo noto lo mostra per la spedizione', () => {
    apri()
    expect(screen.getAllByText('Anna Rossi, Via Roma 1, 81031 Aversa (CE)').length).toBe(3)
  })

  it('un confermato passa in preparazione con un tocco', async () => {
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Inizia la preparazione' }))
    expect(h.aggiorna).toHaveBeenCalledWith('o1', { stato: 'in preparazione' })
  })

  it('le note di preparazione si salvano', async () => {
    apri()
    const note = screen.getByLabelText('Note di preparazione', { selector: '#note-prep-o2' })
    expect(note).toHaveValue('colore rosso scelto')
    await userEvent.type(note, ' - manca il nastro')
    await userEvent.click(within(note.closest('div')!).getByRole('button', { name: 'Salva note' }))
    expect(h.aggiorna).toHaveBeenCalledWith('o2', { notePreparazione: 'colore rosso scelto - manca il nastro' })
    expect(await screen.findByText('Note salvate')).toBeInTheDocument()
  })

  it('un in preparazione passa a pronto', async () => {
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Segna come pronto' }))
    expect(h.aggiorna).toHaveBeenCalledWith('o2', { stato: 'pronto' })
  })

  it('un pronto si segna spedito con corriere e tracking', async () => {
    apri()
    await userEvent.type(screen.getByLabelText('Corriere (facoltativo)'), 'GLS')
    await userEvent.type(screen.getByLabelText('Codice di tracciamento (facoltativo)'), 'ZZ99')
    await userEvent.click(screen.getByRole('button', { name: 'Segna come spedito' }))
    expect(h.aggiorna).toHaveBeenCalledWith('o3', {
      stato: 'spedito',
      corriere: 'GLS',
      tracking: 'ZZ99',
      dataSpedizione: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })

  it('corriere e tracking sono facoltativi', async () => {
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Segna come spedito' }))
    expect(h.aggiorna).toHaveBeenCalledWith('o3', expect.objectContaining({ stato: 'spedito', corriere: '', tracking: '' }))
  })

  it('un pronto senza nessun pagamento non si può spedire', async () => {
    h.ordini = [ordineDiProva({ id: 'x', numero: 9, stato: 'pronto' })]
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Segna come spedito' }))
    expect(await screen.findByText(/Senza un acconto non si procede/, { selector: '[role="alert"]' })).toBeInTheDocument()
    expect(h.aggiorna).not.toHaveBeenCalled()
  })

  it('un errore di salvataggio si vede', async () => {
    h.aggiorna.mockImplementation(async () => {
      throw new Error('offline')
    })
    apri()
    await userEvent.click(screen.getByRole('button', { name: 'Inizia la preparazione' }))
    expect(await screen.findByText(/Non sono riuscito a salvare/)).toBeInTheDocument()
  })
})

describe('Spediti', () => {
  it('mostra l\'avviso WhatsApp con corriere e tracking e il collegamento alla spesa', async () => {
    apri()
    await vai(/Spediti/)
    expect(screen.getByText(/n\. 4 ·/)).toBeInTheDocument()
    const wa = screen.getByRole('link', { name: 'Avvisa la spedizione su WhatsApp' })
    const url = wa.getAttribute('href')!
    expect(url.startsWith('https://wa.me/393331234567?text=')).toBe(true)
    const testo = decodeURIComponent(url.split('?text=')[1])
    expect(testo).toContain('è stato spedito')
    expect(testo).toContain('Corriere: GLS')
    expect(testo).toContain('AB123')
    expect(testo).toContain('Anna Rossi, Via Roma 1, 81031 Aversa (CE)')
    expect(screen.getByRole('link', { name: 'Registra il costo della spedizione' })).toHaveAttribute(
      'href',
      '/spese?categoria=Spedizioni&descrizione=Spedizione%20ordine%20n.%204',
    )
  })

  it('senza telefono il pulsante WhatsApp è disabilitato', async () => {
    h.clienti = []
    h.ordini = [ordineDiProva({ id: 'o4', numero: 4, stato: 'spedito', pagamenti: pag, clienteTelefono: undefined })]
    apri('/spedizioni?vista=spediti')
    expect(screen.getByRole('button', { name: 'Avvisa la spedizione su WhatsApp' })).toBeDisabled()
    expect(screen.getByText('Aggiungi il telefono del cliente')).toBeInTheDocument()
  })

  it('un telefono aggiunto nella scheda cliente vale anche per ordini vecchi', () => {
    h.ordini = [ordineDiProva({ id: 'o4', numero: 4, stato: 'spedito', pagamenti: pag, clienteTelefono: undefined })]
    apri('/spedizioni?vista=spediti')
    expect(screen.getByRole('link', { name: 'Avvisa la spedizione su WhatsApp' }).getAttribute('href')).toMatch(/wa\.me\/393331234567/)
  })

  it('i dati del corriere si possono correggere dopo', async () => {
    apri('/spedizioni?vista=spediti')
    const tracking = screen.getByLabelText('Codice di tracciamento (facoltativo)')
    await userEvent.clear(tracking)
    await userEvent.type(tracking, 'NUOVO1')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiorna i dati' }))
    expect(h.aggiorna).toHaveBeenCalledWith('o4', { corriere: 'GLS', tracking: 'NUOVO1' })
  })

  it('si segna consegnato', async () => {
    apri('/spedizioni?vista=spediti')
    await userEvent.click(screen.getByRole('button', { name: 'Segna come consegnato' }))
    expect(h.aggiorna).toHaveBeenCalledWith('o4', { stato: 'consegnato' })
  })
})

describe('In attesa di acconto', () => {
  it('spiega che non si procede e rimanda a registrare l\'acconto, senza pulsanti per avanzare', async () => {
    apri()
    await vai(/In attesa di acconto/)
    expect(screen.getByText(/n\. 5 ·/)).toBeInTheDocument()
    expect(screen.getAllByText(/non si procede/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Registra l\'acconto' })).toHaveAttribute('href', '/ordini/o5')
    expect(screen.queryByRole('button', { name: /Segna|Inizia|Conferma/ })).not.toBeInTheDocument()
  })
})

describe('Consegnati e vuoti', () => {
  it('mostra i consegnati', async () => {
    apri()
    await vai(/Consegnati/)
    expect(screen.getByText(/n\. 6 ·/)).toBeInTheDocument()
  })
  it('messaggi chiari quando non c\'è niente', () => {
    h.ordini = []
    apri()
    expect(screen.getByText(/Niente da lavorare/)).toBeInTheDocument()
  })
  it('una vista sconosciuta nel link torna a "Da lavorare"', () => {
    apri('/spedizioni?vista=boh')
    expect(screen.getByRole('button', { name: /Da lavorare/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
