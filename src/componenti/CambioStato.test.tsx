import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArticoliProvider } from './ArticoliContext'
import { AvvisoMateriali, useCambioStato } from './CambioStato'
import { MaterialiOrdine } from './MaterialiOrdine'
import { ordineDiProva } from '../lib/fixture'
import { ErroreMateriali, fabbisogno, verificaDisponibilita } from '../lib/ricette'
import { ErroreRegola } from '../lib/stati'
import type { Articolo, Ordine } from '../lib/tipi'

const h = vi.hoisted(() => ({ articoli: [] as Articolo[], cambia: vi.fn() }))

vi.mock('../data/magazzino', () => ({
  ascoltaArticoli: (cb: (a: Articolo[]) => void) => {
    cb(h.articoli)
    return () => {}
  },
}))
vi.mock('../data/ordini', () => ({ cambiaStatoOrdine: (...a: unknown[]) => h.cambia(...a) }))

const filamento: Articolo = { id: 'fil', nome: 'Filamento PLA', tipo: 'materiale', unita: 'kg', giacenza: 300, attivo: true }
const anello: Articolo = { id: 'ane', nome: 'Anello', tipo: 'materiale', unita: 'pezzi', giacenza: 100, attivo: true }
const segnaposto: Articolo = {
  id: 'seg',
  nome: 'Segnaposto 3D',
  tipo: 'prodotto',
  unita: 'pezzi',
  giacenza: 0,
  prezzoCent: 250,
  attivo: true,
  ricetta: [
    { articoloId: 'fil', quantita: 18 },
    { articoloId: 'ane', quantita: 1 },
  ],
}
const semplice: Articolo = { id: 'sem', nome: 'Rivendita', tipo: 'prodotto', unita: 'pezzi', giacenza: 3, prezzoCent: 100, attivo: true }

const pagato = [{ importoCent: 500, data: '2026-11-05' }]
const ordineCon = (articoloId: string, quantita: number, extra: Partial<Ordine> = {}): Ordine =>
  ordineDiProva({
    stato: 'confermato',
    pagamenti: pagato,
    righe: [{ articoloId, descrizione: 'x', quantita, prezzoUnitarioCent: 250 }],
    ...extra,
  })

function Prova({ ordine, nuovo = 'in preparazione' }: { ordine: Ordine; nuovo?: Parameters<ReturnType<typeof useCambioStato>['cambia']>[0] }) {
  const { cambia, procediComunque, ferma, avviso, errore, occupato } = useCambioStato(ordine)
  return (
    <div>
      <button onClick={() => void cambia(nuovo)}>Vai</button>
      {errore && <p role="alert">{errore}</p>}
      <AvvisoMateriali avviso={avviso} onProcedi={() => void procediComunque()} onFerma={ferma} occupato={occupato} />
    </div>
  )
}

const apri = (ordine: Ordine, nuovo?: Parameters<typeof Prova>[0]['nuovo']) =>
  render(
    <ArticoliProvider>
      <Prova ordine={ordine} nuovo={nuovo} />
    </ArticoliProvider>,
  )

beforeEach(() => {
  h.articoli = [filamento, anello, segnaposto, semplice]
  h.cambia.mockReset()
  h.cambia.mockResolvedValue(undefined)
})

describe('prima di "In preparazione"', () => {
  it('se i materiali bastano cambia stato senza avvisi', async () => {
    apri(ordineCon('seg', 10)) // 180 g di 300
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(h.cambia).toHaveBeenCalledWith('o1', 'in preparazione', { procediComunque: false, extra: undefined })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('se mancano, non cambia nulla e mostra cosa manca', async () => {
    apri(ordineCon('seg', 30)) // 540 g di 300
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(h.cambia).not.toHaveBeenCalled()
    const avviso = screen.getByRole('alertdialog', { name: 'Materiali che mancano' })
    expect(avviso).toHaveTextContent('Filamento PLA: servono 540 g, ne hai 300 g')
    expect(avviso).not.toHaveTextContent('Anello') // gli anelli bastano
  })

  it('"Procedi comunque" cambia stato dicendo di scalare quanto c\'è', async () => {
    apri(ordineCon('seg', 30))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    await userEvent.click(screen.getByRole('button', { name: 'Procedi comunque' }))
    expect(h.cambia).toHaveBeenCalledWith('o1', 'in preparazione', { procediComunque: true, extra: undefined })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('"Ferma, riordino" chiude l\'avviso e non cambia nulla', async () => {
    apri(ordineCon('seg', 30))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ferma, riordino' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(h.cambia).not.toHaveBeenCalled()
  })

  it('se nel frattempo il magazzino è cambiato, è la transazione a dirlo e l\'avviso compare lo stesso', async () => {
    const v = verificaDisponibilita(fabbisogno(ordineCon('seg', 30).righe, h.articoli).voci, h.articoli)
    h.articoli = [{ ...filamento, giacenza: 100000 }, anello, segnaposto] // la copia in memoria dice "bastano"
    h.cambia.mockImplementation(async () => {
      throw new ErroreMateriali(v.mancanti)
    })
    apri(ordineCon('seg', 30))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(h.cambia).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Filamento PLA')
  })

  it('un ordine con i materiali già scalati non si ricontrolla (non si scala due volte)', async () => {
    apri(
      ordineCon('seg', 30, {
        scaricoMagazzino: { data: '2026-11-20', voci: [{ articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 540, scalata: 300 }] },
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(h.cambia).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('righe a mano o prodotti senza ricetta: nessun controllo', async () => {
    apri(ordineCon('sem', 2))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(h.cambia).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('gli altri passaggi di stato non controllano i materiali', async () => {
    apri(ordineCon('seg', 30, { stato: 'in preparazione' }), 'pronto')
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(h.cambia).toHaveBeenCalledWith('o1', 'pronto', { procediComunque: false, extra: undefined })
  })
})

describe('doppio tocco', () => {
  it('un secondo tocco mentre il primo è in corso non manda una seconda richiesta; poi si può ripartire', async () => {
    let finisci: () => void = () => {}
    h.cambia.mockImplementation(() => new Promise<void>((ok) => (finisci = ok)))
    apri(ordineCon('sem', 1))
    const vai = screen.getByRole('button', { name: 'Vai' })
    await userEvent.click(vai)
    await userEvent.click(vai)
    await userEvent.click(vai)
    expect(h.cambia).toHaveBeenCalledTimes(1)
    finisci()
    await vi.waitFor(async () => {
      await userEvent.click(vai)
      expect(h.cambia).toHaveBeenCalledTimes(2)
    })
  })

  it('anche un tocco ripetuto su "Procedi comunque" parte una volta sola', async () => {
    apri(ordineCon('seg', 30))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    let finisci: () => void = () => {}
    h.cambia.mockImplementation(() => new Promise<void>((ok) => (finisci = ok)))
    const procedi = screen.getByRole('button', { name: 'Procedi comunque' })
    await userEvent.click(procedi)
    await userEvent.click(procedi)
    expect(h.cambia).toHaveBeenCalledTimes(1)
    finisci()
  })
})

describe('regole e errori', () => {
  it('senza acconto non si procede e non si chiama il database', async () => {
    apri(ordineCon('seg', 1, { pagamenti: [], stato: 'in attesa acconto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Senza un acconto non si procede/)
    expect(h.cambia).not.toHaveBeenCalled()
  })

  it('il messaggio di una regola si mostra così com\'è', async () => {
    h.cambia.mockImplementation(async () => {
      throw new ErroreRegola('Ordine non trovato: forse è stato eliminato.')
    })
    apri(ordineCon('sem', 1))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ordine non trovato')
  })

  it('un guasto generico parla di connessione', async () => {
    h.cambia.mockImplementation(async () => {
      throw new Error('offline')
    })
    apri(ordineCon('sem', 1))
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Non sono riuscito a salvare/)
  })
})

describe('MaterialiOrdine', () => {
  const mostra = (o: Ordine) =>
    render(
      <ArticoliProvider>
        <MaterialiOrdine ordine={o} />
      </ArticoliProvider>,
    )

  it('prima della preparazione dice cosa serve e se basta', () => {
    mostra(ordineCon('seg', 10))
    expect(screen.getByText(/Materiali che serviranno:/).parentElement).toHaveTextContent('Filamento PLA 180 g, Anello 10 pezzi')
    expect(screen.getByRole('status')).toHaveTextContent('In magazzino ce n\'è abbastanza')
  })

  it('se non basta lo dice chiaro, con le quantità', () => {
    mostra(ordineCon('seg', 30))
    expect(screen.getByText(/Non bastano:/)).toHaveTextContent('Filamento PLA: servono 540 g, ne hai 300 g')
  })

  it('dopo lo scarico elenca cosa è stato scalato e cosa mancava', () => {
    mostra(
      ordineCon('seg', 30, {
        stato: 'in preparazione',
        scaricoMagazzino: {
          data: '2026-11-20',
          voci: [
            { articoloId: 'fil', nome: 'Filamento PLA', unita: 'kg', necessaria: 540, scalata: 300 },
            { articoloId: 'ane', nome: 'Anello', unita: 'pezzi', necessaria: 30, scalata: 30 },
          ],
        },
      }),
    )
    expect(screen.getByText(/Materiali scalati dal magazzino/).parentElement).toHaveTextContent('20/11/2026')
    expect(screen.getByText(/Filamento PLA: 300 g/)).toHaveTextContent('(ne mancavano 240 g)')
    expect(screen.getByText(/Anello: 30 pezzi/)).not.toHaveTextContent('mancavano')
  })

  it('niente per ordini senza ricette o con righe scritte a mano', () => {
    const { container } = mostra(ordineCon('sem', 2))
    expect(container).toBeEmptyDOMElement()
  })

  it.each(['spedito', 'consegnato', 'annullato'] as const)('niente per un ordine %s senza scarico', (stato) => {
    const { container } = mostra(ordineCon('seg', 30, { stato }))
    expect(container).toBeEmptyDOMElement()
  })

  it('segnala un ingrediente disattivato', () => {
    h.articoli = [filamento, { ...anello, attivo: false }, segnaposto]
    mostra(ordineCon('seg', 1))
    expect(screen.getByText(/"Anello" è disattivato/)).toBeInTheDocument()
  })
})
