import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RicettaArticolo } from './RicettaArticolo'
import type { Articolo } from '../lib/tipi'

const h = vi.hoisted(() => ({ aggiorna: vi.fn() }))
vi.mock('../data/magazzino', () => ({ aggiornaArticolo: (...a: unknown[]) => h.aggiorna(...a) }))

const mat = (id: string, nome: string, unita: Articolo['unita'], giacenza: number, extra: Partial<Articolo> = {}): Articolo => ({
  id,
  nome,
  tipo: 'materiale',
  unita,
  giacenza,
  attivo: true,
  ...extra,
})

const filamento = mat('fil', 'Filamento PLA', 'kg', 300) // 300 g in magazzino, scorta in chili
const anello = mat('ane', 'Anello portachiavi', 'pezzi', 10)
const vecchio = mat('vec', 'Vecchia vernice', 'ml', 500, { attivo: false })
const altroProdotto: Articolo = { id: 'p2', nome: 'Altro prodotto', tipo: 'prodotto', unita: 'pezzi', giacenza: 0, prezzoCent: 100, attivo: true }
const prodotto: Articolo = { id: 'seg', nome: 'Segnaposto 3D', tipo: 'prodotto', unita: 'pezzi', giacenza: 0, prezzoCent: 250, attivo: true }
const tutti = [filamento, anello, vecchio, altroProdotto, prodotto]

beforeEach(() => {
  h.aggiorna.mockReset()
  h.aggiorna.mockResolvedValue(undefined)
})

const apri = (p: Articolo = prodotto, elenco: Articolo[] = tutti) => render(<RicettaArticolo prodotto={p} tutti={elenco} />)

async function aggiungi(materiale: string, quantita: string, unita?: string) {
  await userEvent.selectOptions(screen.getByLabelText('Aggiungi un materiale'), materiale)
  if (unita) await userEvent.selectOptions(screen.getByLabelText('Unità'), unita)
  await userEvent.type(screen.getByLabelText('Quantità per pezzo'), quantita)
  await userEvent.click(screen.getByRole('button', { name: '+ Aggiungi alla ricetta' }))
}

describe('ricetta vuota', () => {
  it('spiega che senza ricetta il prodotto non scala nulla, e non mostra "pezzi realizzabili"', () => {
    apri()
    expect(screen.getByText(/non scala nulla dal magazzino/)).toBeInTheDocument()
    expect(screen.queryByText(/puoi fare/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salva ricetta' })).toBeDisabled()
  })

  it('propone solo Materiali in uso (non prodotti, non disattivati)', () => {
    apri()
    const opzioni = within(screen.getByLabelText('Aggiungi un materiale')).getAllByRole('option').map((o) => o.textContent)
    expect(opzioni).toEqual(['Scegli…', 'Filamento PLA', 'Anello portachiavi'])
  })

  it('senza materiali nel magazzino indica come crearli', () => {
    apri(prodotto, [prodotto])
    expect(screen.getByText(/Non hai ancora materiali/)).toBeInTheDocument()
  })
})

describe('aggiungere ingredienti', () => {
  it('18 g di filamento (scorta in chili) e 1 pezzo di anello: si salva in unità base', async () => {
    apri()
    await aggiungi('fil', '18')
    await aggiungi('ane', '1')
    expect(screen.getByText(/Filamento PLA:/).parentElement).toHaveTextContent('Filamento PLA: 18 g')
    expect(screen.getByText(/Anello portachiavi:/).parentElement).toHaveTextContent('Anello portachiavi: 1 pezzo')
    await userEvent.click(screen.getByRole('button', { name: 'Salva ricetta' }))
    expect(h.aggiorna).toHaveBeenCalledWith('seg', {
      ricetta: [
        { articoloId: 'fil', quantita: 18 },
        { articoloId: 'ane', quantita: 1 },
      ],
    })
    expect(await screen.findByText('Ricetta salvata')).toBeInTheDocument()
  })

  it('l\'unità di partenza è la più piccola (g per i chili) e si può scrivere anche in chili', async () => {
    apri()
    await userEvent.selectOptions(screen.getByLabelText('Aggiungi un materiale'), 'fil')
    expect(screen.getByLabelText('Unità')).toHaveValue('g')
    await userEvent.selectOptions(screen.getByLabelText('Unità'), 'kg')
    await userEvent.type(screen.getByLabelText('Quantità per pezzo'), '0,5')
    await userEvent.click(screen.getByRole('button', { name: '+ Aggiungi alla ricetta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salva ricetta' }))
    expect(h.aggiorna).toHaveBeenCalledWith('seg', { ricetta: [{ articoloId: 'fil', quantita: 500 }] })
  })

  it('le unità offerte sono solo quelle compatibili con il materiale', async () => {
    apri()
    await userEvent.selectOptions(screen.getByLabelText('Aggiungi un materiale'), 'fil')
    expect(within(screen.getByLabelText('Unità')).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['g', 'kg'])
    await userEvent.selectOptions(screen.getByLabelText('Aggiungi un materiale'), 'ane')
    expect(within(screen.getByLabelText('Unità')).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['pezzi'])
  })

  it('dopo l\'aggiunta il modulo si svuota, pronto per il materiale successivo', async () => {
    apri()
    await aggiungi('fil', '18')
    expect(screen.getByLabelText('Aggiungi un materiale')).toHaveValue('')
    expect(screen.getByLabelText('Quantità per pezzo')).toHaveValue('')
  })

  it('mostra quanti pezzi si possono fare col magazzino di oggi e si aggiorna', async () => {
    apri()
    await aggiungi('fil', '18') // 300 / 18 = 16
    expect(screen.getByRole('status')).toHaveTextContent('puoi fare 16 pezzi')
    await aggiungi('ane', '1') // anelli 10 → 10
    expect(screen.getByText(/puoi fare/).textContent).toMatch(/10 pezzi/)
  })

  it('"1 pezzo" al singolare', async () => {
    apri(prodotto, [{ ...anello, giacenza: 1 }, prodotto])
    await aggiungi('ane', '1')
    expect(screen.getByText(/puoi fare/)).toHaveTextContent('1 pezzo.')
  })
})

describe('controlli', () => {
  it('senza scegliere il materiale', async () => {
    apri()
    await userEvent.type(screen.getByLabelText('Quantità per pezzo'), '5')
    await userEvent.click(screen.getByRole('button', { name: '+ Aggiungi alla ricetta' }))
    expect(await screen.findByText('Scegli un materiale')).toBeInTheDocument()
  })

  it.each(['', 'abc', '0', '-5', '2,5'])('quantità non valida "%s" per i pezzi', async (q) => {
    apri()
    await userEvent.selectOptions(screen.getByLabelText('Aggiungi un materiale'), 'ane')
    if (q) await userEvent.type(screen.getByLabelText('Quantità per pezzo'), q)
    await userEvent.click(screen.getByRole('button', { name: '+ Aggiungi alla ricetta' }))
    expect(await screen.findByText(/Scrivi una quantità valida in pezzi/)).toBeInTheDocument()
    expect(screen.getByText(/non scala nulla/)).toBeInTheDocument()
  })

  it('lo stesso materiale non si mette due volte', async () => {
    apri()
    await aggiungi('fil', '18')
    await aggiungi('fil', '20')
    expect(await screen.findByText(/è già nella ricetta/)).toBeInTheDocument()
    expect(screen.getAllByText(/Filamento PLA:/)).toHaveLength(1)
  })
})

describe('ricetta esistente', () => {
  const conRicetta: Articolo = { ...prodotto, ricetta: [{ articoloId: 'fil', quantita: 18 }, { articoloId: 'ane', quantita: 1 }] }

  it('mostra gli ingredienti in unità comode e il Salva è spento finché non cambia nulla', () => {
    apri(conRicetta)
    expect(screen.getByText(/Filamento PLA:/).parentElement).toHaveTextContent('Filamento PLA: 18 g')
    expect(screen.getByRole('button', { name: 'Salva ricetta' })).toBeDisabled()
  })

  it('un ingrediente di 1,5 kg si legge in chili, non in grammi esagerati', () => {
    apri({ ...prodotto, ricetta: [{ articoloId: 'fil', quantita: 1500 }] })
    expect(screen.getByText(/Filamento PLA:/).parentElement).toHaveTextContent('Filamento PLA: 1,5 kg')
  })

  it('togliere un ingrediente e salvare', async () => {
    apri(conRicetta)
    await userEvent.click(screen.getByRole('button', { name: 'Togli Anello portachiavi dalla ricetta' }))
    expect(screen.queryByText(/Anello portachiavi:/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salva ricetta' }))
    expect(h.aggiorna).toHaveBeenCalledWith('seg', { ricetta: [{ articoloId: 'fil', quantita: 18 }] })
  })

  it('togliere tutto salva una ricetta vuota', async () => {
    apri({ ...prodotto, ricetta: [{ articoloId: 'fil', quantita: 18 }] })
    await userEvent.click(screen.getByRole('button', { name: 'Togli Filamento PLA dalla ricetta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salva ricetta' }))
    expect(h.aggiorna).toHaveBeenCalledWith('seg', { ricetta: [] })
  })

  it('un materiale sparito dal magazzino si vede, e si può togliere', async () => {
    apri({ ...prodotto, ricetta: [{ articoloId: 'fantasma', quantita: 5 }] }, [prodotto])
    expect(screen.getByText(/Materiale non trovato/)).toBeInTheDocument()
    expect(screen.getByText(/puoi fare/)).toHaveTextContent('0 pezzi')
    await userEvent.click(screen.getByRole('button', { name: 'Togli materiale dalla ricetta' }))
    expect(screen.queryByText(/Materiale non trovato/)).not.toBeInTheDocument()
  })

  it('un errore di salvataggio si vede e non dice "salvata"', async () => {
    h.aggiorna.mockImplementation(async () => {
      throw new Error('offline')
    })
    apri(conRicetta)
    await userEvent.click(screen.getByRole('button', { name: 'Togli Anello portachiavi dalla ricetta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salva ricetta' }))
    expect(await screen.findByText(/Non sono riuscito a salvare/)).toBeInTheDocument()
    expect(screen.queryByText('Ricetta salvata')).not.toBeInTheDocument()
  })
})
