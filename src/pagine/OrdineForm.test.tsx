import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import OrdineForm from './OrdineForm'
import { ordineDiProva } from '../lib/fixture'
import { ErroreMateriali } from '../lib/ricette'

const h = vi.hoisted(() => ({ crea: vi.fn(), modifica: vi.fn() }))

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
  modificaOrdine: (...a: unknown[]) => h.modifica(...a),
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
  h.modifica.mockReset()
  h.modifica.mockResolvedValue(undefined)
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

describe('righe collegate al prodotto del magazzino (servono per scalare i materiali)', () => {
  it('una riga scelta dalla lista ricorda il prodotto', async () => {
    apri()
    await scegliCliente()
    await userEvent.click(screen.getByRole('button', { name: /Candela grande · 8,00/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect(h.crea.mock.calls[0][0].righe).toEqual([
      { articoloId: 'l1', descrizione: 'Candela grande', quantita: 1, prezzoUnitarioCent: 800 },
    ])
  })

  it('una riga scritta a mano non ha il collegamento (e quindi non scala nulla)', async () => {
    apri()
    await scegliCliente()
    await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Candela grande')
    await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '8')
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect('articoloId' in h.crea.mock.calls[0][0].righe[0]).toBe(false)
  })

  it('una riga scritta a mano con lo stesso nome non si fonde con quella scelta dalla lista', async () => {
    apri()
    await scegliCliente()
    await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Candela grande')
    await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '8')
    await userEvent.click(screen.getByRole('button', { name: /Candela grande · 8,00/ }))
    expect(screen.getByLabelText('Prodotto 2')).toHaveValue('Candela grande')
    expect(screen.getByLabelText('Quantità 1')).toHaveValue('1')
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    const righe = h.crea.mock.calls[0][0].righe
    expect(righe).toHaveLength(2)
    expect(righe[1].articoloId).toBe('l1')
  })

  it('toccare due volte lo stesso prodotto aumenta la quantità e resta collegato', async () => {
    apri()
    await scegliCliente()
    const candela = screen.getByRole('button', { name: /Candela grande · 8,00/ })
    await userEvent.click(candela)
    await userEvent.click(candela)
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect(h.crea.mock.calls[0][0].righe).toEqual([{ articoloId: 'l1', descrizione: 'Candela grande', quantita: 2, prezzoUnitarioCent: 800 }])
  })
})

describe('costo di spedizione nel modulo ordine', () => {
  async function conUnProdotto() {
    apri()
    await scegliCliente()
    await userEvent.type(screen.getByLabelText('Prodotto 1'), 'Candela')
    await userEvent.type(screen.getByLabelText(/Prezzo unitario 1/), '17,50')
  }
  const campo = () => screen.getByLabelText(/Costo di spedizione/)

  it('il campo c\'è ed è facoltativo: vuoto = nessuna riga di spedizione nell\'ordine', async () => {
    await conUnProdotto()
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect('costoSpedizioneCent' in h.crea.mock.calls[0][0]).toBe(false)
  })

  it('5,90 € di spedizione: si salva in centesimi e il totale la comprende', async () => {
    await conUnProdotto()
    await userEvent.type(campo(), '5,90')
    expect(screen.getByTestId('totale').textContent).toMatch(/23,40/)
    expect(screen.getByText(/Totale \(spedizione compresa\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect(h.crea.mock.calls[0][0].costoSpedizioneCent).toBe(590)
  })

  it('0 vuol dire "spedizione gratuita": si salva 0 e il totale non cambia', async () => {
    await conUnProdotto()
    await userEvent.type(campo(), '0')
    expect(screen.getByTestId('totale').textContent).toMatch(/17,50/)
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect(h.crea.mock.calls[0][0].costoSpedizioneCent).toBe(0)
  })

  it('un importo non valido blocca il salvataggio con un messaggio chiaro', async () => {
    await conUnProdotto()
    await userEvent.type(campo(), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect(await screen.findByText(/costo di spedizione non è valido/i)).toBeInTheDocument()
    expect(h.crea).not.toHaveBeenCalled()
  })

  it('un importo negativo non è valido', async () => {
    await conUnProdotto()
    await userEvent.type(campo(), '-3')
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect(await screen.findByText(/costo di spedizione non è valido/i)).toBeInTheDocument()
    expect(h.crea).not.toHaveBeenCalled()
  })

  it('l\'acconto ricevuto si confronta con il totale comprensivo di spedizione (l\'ordine nasce confermato)', async () => {
    await conUnProdotto()
    await userEvent.type(campo(), '5,90')
    await userEvent.type(screen.getByLabelText(/Acconto ricevuto/), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Salva ordine' }))
    expect(h.crea.mock.calls[0][0].stato).toBe('confermato')
    expect(h.crea.mock.calls[0][0].pagamenti).toEqual([{ importoCent: 1000, data: expect.any(String) }])
  })
})

describe('modifica di un ordine esistente', () => {
  const apriModifica = (extra = {}) =>
    render(
      <MemoryRouter>
        <OrdineForm iniziale={ordineDiProva({ costoSpedizioneCent: 590, dataConsegna: '2026-12-20', note: 'Nota vecchia', ...extra })} />
      </MemoryRouter>,
    )

  it('si apre già compilato, senza acconto e con il titolo giusto', () => {
    apriModifica()
    expect(screen.getByRole('heading', { name: 'Modifica ordine n. 7' })).toBeInTheDocument()
    expect(screen.getByText(/Maria Rossi · 333 123-4567/)).toBeInTheDocument()
    expect(screen.getByLabelText('Prodotto 1')).toHaveValue('Segnaposto')
    expect(screen.getByLabelText('Testo personalizzato 1')).toHaveValue('Mario')
    expect(screen.getByLabelText('Quantità 1')).toHaveValue('3')
    expect(screen.getByLabelText(/Costo di spedizione/)).toHaveValue('5,90')
    expect(screen.getByLabelText('Note')).toHaveValue('Nota vecchia')
    expect(screen.queryByLabelText(/Acconto ricevuto/)).not.toBeInTheDocument()
    expect(screen.getByTestId('totale').textContent).toMatch(/23,40/)
  })

  it('salva con modificaOrdine (non crea un ordine nuovo) e passa i dati cambiati', async () => {
    apriModifica()
    await userEvent.clear(screen.getByLabelText('Quantità 1'))
    await userEvent.type(screen.getByLabelText('Quantità 1'), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(h.crea).not.toHaveBeenCalled()
    expect(h.modifica).toHaveBeenCalledTimes(1)
    const [id, dati, opz] = h.modifica.mock.calls[0]
    expect(id).toBe('o1')
    expect(dati.righe[0]).toMatchObject({ descrizione: 'Segnaposto', quantita: 4, prezzoUnitarioCent: 250 })
    expect(dati.costoSpedizioneCent).toBe(590)
    expect(dati.dataConsegna).toBe('2026-12-20')
    expect(opz).toEqual({ procediComunque: false })
  })

  it('svuotando spedizione, consegna e note, non li passa più', async () => {
    apriModifica()
    await userEvent.clear(screen.getByLabelText(/Costo di spedizione/))
    await userEvent.clear(screen.getByLabelText('Note'))
    await userEvent.clear(screen.getByLabelText('Data di consegna'))
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    const dati = h.modifica.mock.calls[0][1]
    expect('costoSpedizioneCent' in dati).toBe(false)
    expect('note' in dati).toBe(false)
    expect('dataConsegna' in dati).toBe(false)
  })

  it('mantiene il collegamento al prodotto del magazzino delle righe', async () => {
    apriModifica({ righe: [{ articoloId: 'l1', descrizione: 'Candela grande', quantita: 1, prezzoUnitarioCent: 800 }] })
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(h.modifica.mock.calls[0][1].righe).toEqual([{ articoloId: 'l1', descrizione: 'Candela grande', quantita: 1, prezzoUnitarioCent: 800 }])
  })

  it('senza righe valide non salva', async () => {
    apriModifica()
    await userEvent.clear(screen.getByLabelText('Prodotto 1'))
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByText(/almeno un prodotto/)).toBeInTheDocument()
    expect(h.modifica).not.toHaveBeenCalled()
  })

  it('se mancano materiali avvisa; "Procedi comunque" salva con procediComunque', async () => {
    h.modifica.mockRejectedValueOnce(new ErroreMateriali([{ articoloId: 'l4', nome: 'Cera di soia', unita: 'kg', necessaria: 600, disponibile: 300, mancante: 300 }]))
    apriModifica({ scaricoMagazzino: { data: '2026-11-02', voci: [] }, stato: 'in preparazione' })
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByRole('alertdialog', { name: 'Materiali che mancano' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Procedi comunque' }))
    expect(h.modifica).toHaveBeenCalledTimes(2)
    expect(h.modifica.mock.calls[1][2]).toEqual({ procediComunque: true })
  })

  it("«Ferma» chiude l'avviso e non salva di nuovo", async () => {
    h.modifica.mockRejectedValueOnce(new ErroreMateriali([{ articoloId: 'l4', nome: 'Cera di soia', unita: 'kg', necessaria: 600, disponibile: 300, mancante: 300 }]))
    apriModifica({ scaricoMagazzino: { data: '2026-11-02', voci: [] }, stato: 'in preparazione' })
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    await userEvent.click(await screen.findByRole('button', { name: /Ferma/ }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(h.modifica).toHaveBeenCalledTimes(1)
  })

  it('un errore di scrittura si legge e il pulsante si riattiva', async () => {
    h.modifica.mockRejectedValueOnce(new Error('rete'))
    apriModifica()
    await userEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(await screen.findByText(/Non sono riuscito a salvare/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeEnabled()
  })

  it("avvisa quando i materiali sono già scalati o l'ordine è già partito", () => {
    const { unmount } = apriModifica({ scaricoMagazzino: { data: '2026-11-02', voci: [] }, stato: 'in preparazione' })
    expect(screen.getByText(/già stati scalati/)).toBeInTheDocument()
    unmount()
    apriModifica({ stato: 'spedito' })
    expect(screen.getByText(/già partito/)).toBeInTheDocument()
  })

  it("il percorso e Annulla riportano all'ordine", () => {
    apriModifica()
    expect(screen.getByRole('link', { name: 'n. 7' })).toHaveAttribute('href', '/ordini/o1')
    expect(screen.getByRole('link', { name: 'Annulla' })).toHaveAttribute('href', '/ordini/o1')
  })
})
