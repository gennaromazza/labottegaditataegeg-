import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Magazzino from './Magazzino'
import { ErroreRegola } from '../lib/stati'
import type { Articolo, Movimento } from '../lib/tipi'

const h = vi.hoisted(() => ({
  articoli: [] as Articolo[],
  movimenti: [] as Movimento[],
  crea: vi.fn(),
  aggiorna: vi.fn(),
  registra: vi.fn(),
}))

vi.mock('../data/magazzino', () => ({
  ascoltaArticoli: (cb: (a: Articolo[]) => void) => {
    cb(h.articoli)
    return () => {}
  },
  ascoltaMovimenti: (_id: string, cb: (m: Movimento[]) => void) => {
    cb(h.movimenti)
    return () => {}
  },
  creaArticolo: (...a: unknown[]) => h.crea(...a),
  aggiornaArticolo: (...a: unknown[]) => h.aggiorna(...a),
  registraMovimento: (...a: unknown[]) => h.registra(...a),
}))

const cera: Articolo = { id: 'a1', nome: 'Cera di soia', tipo: 'materiale', unita: 'kg', giacenza: 2500, attivo: true }
const stoppini: Articolo = { id: 'a2', nome: 'Stoppini', tipo: 'materiale', unita: 'pezzi', giacenza: 1, attivo: true }
const candela: Articolo = { id: 'a3', nome: 'Candela grande', tipo: 'prodotto', unita: 'pezzi', giacenza: 12, prezzoCent: 800, attivo: true }
const vecchio: Articolo = { id: 'a4', nome: 'Vecchio profumo', tipo: 'materiale', unita: 'ml', giacenza: 0, attivo: false }

beforeEach(() => {
  h.articoli = [cera, stoppini, candela, vecchio]
  h.movimenti = []
  for (const f of [h.crea, h.aggiorna, h.registra]) {
    f.mockReset()
    f.mockResolvedValue(undefined)
  }
})

const apri = () => render(<Magazzino />)
const presente = (nome: string) => screen.queryByRole('article', { name: `Articolo ${nome}` }) !== null
const scheda = (nome: string) => screen.getByRole('article', { name: `Articolo ${nome}` })
const gestisci = (nome: string) => userEvent.click(within(scheda(nome)).getByRole('button', { name: new RegExp(`Gestisci ${nome}`) }))

describe('elenco', () => {
  it('mostra la giacenza nell\'unità di ogni articolo', () => {
    apri()
    expect(screen.getByLabelText('Giacenza di Cera di soia')).toHaveTextContent('2,5 kg')
    expect(screen.getByLabelText('Giacenza di Stoppini')).toHaveTextContent('1 pezzo')
    expect(screen.getByLabelText('Giacenza di Candela grande')).toHaveTextContent('12 pezzi')
  })

  it('i prodotti mostrano il prezzo, i materiali no', () => {
    apri()
    expect(within(scheda('Candela grande')).getByText(/8,00 € al pezzo/)).toBeInTheDocument()
    expect(within(scheda('Cera di soia')).queryByText(/€/)).not.toBeInTheDocument()
  })

  it('i disattivati sono nascosti finché non li chiedi', async () => {
    apri()
    expect(presente('Vecchio profumo')).toBe(false)
    await userEvent.click(screen.getByLabelText(/Mostra anche i disattivati \(1\)/))
    expect(presente('Vecchio profumo')).toBe(true)
    expect(within(scheda('Vecchio profumo')).getByText('Disattivato')).toBeInTheDocument()
  })

  it('le linguette per tipo hanno i conteggi e filtrano', async () => {
    apri()
    expect(screen.getByRole('button', { name: 'Tutti (3)' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Materiali (2)' }))
    expect(presente('Cera di soia')).toBe(true)
    expect(presente('Candela grande')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Prodotti (1)' }))
    expect(presente('Candela grande')).toBe(true)
    expect(presente('Cera di soia')).toBe(false)
  })

  it('la ricerca ignora maiuscole e accenti', async () => {
    apri()
    await userEvent.type(screen.getByLabelText('Cerca nel magazzino'), 'STOPP')
    expect(presente('Stoppini')).toBe(true)
    expect(presente('Cera di soia')).toBe(false)
    await userEvent.clear(screen.getByLabelText('Cerca nel magazzino'))
    await userEvent.type(screen.getByLabelText('Cerca nel magazzino'), 'zzz')
    expect(screen.getByText('Nessun articolo corrisponde.')).toBeInTheDocument()
  })

  it('magazzino vuoto: spiega cosa fare', () => {
    h.articoli = []
    apri()
    expect(screen.getByText(/Il magazzino è vuoto/)).toBeInTheDocument()
  })
})

describe('nuovo articolo', () => {
  const apriForm = async () => {
    apri()
    await userEvent.click(screen.getByRole('button', { name: '+ Nuovo articolo' }))
  }

  it('un materiale in chili con giacenza iniziale: la giacenza si converte in unità base', async () => {
    await apriForm()
    await userEvent.type(screen.getByLabelText('Nome'), 'Cera di cocco')
    await userEvent.selectOptions(screen.getByLabelText('Unità di misura'), 'kg')
    await userEvent.type(screen.getByLabelText(/Giacenza iniziale/), '1,25')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al magazzino' }))
    expect(h.crea).toHaveBeenCalledWith({ nome: 'Cera di cocco', tipo: 'materiale', unita: 'kg', attivo: true }, 1250)
  })

  it('scegliendo Prodotto l\'unità diventa Pezzi e non si può cambiare', async () => {
    await apriForm()
    await userEvent.selectOptions(screen.getByLabelText('Unità di misura'), 'kg')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'prodotto')
    expect(screen.getByLabelText('Unità di misura')).toHaveValue('pezzi')
    expect(screen.getByLabelText('Unità di misura')).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'materiale')
    expect(screen.getByLabelText('Unità di misura')).toBeEnabled()
  })

  it('il prezzo di vendita compare solo per i Prodotti ed è obbligatorio', async () => {
    await apriForm()
    expect(screen.queryByLabelText(/Prezzo di vendita/)).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'prodotto')
    await userEvent.type(screen.getByLabelText('Nome'), 'Segnaposto')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al magazzino' }))
    expect(await screen.findByText('Un prodotto ha bisogno del prezzo di vendita')).toBeInTheDocument()
    expect(h.crea).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText(/Prezzo di vendita/), '2,50')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al magazzino' }))
    expect(h.crea).toHaveBeenCalledWith({ nome: 'Segnaposto', tipo: 'prodotto', unita: 'pezzi', attivo: true, prezzoCent: 250 }, 0)
  })

  it('senza nome non salva', async () => {
    await apriForm()
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al magazzino' }))
    expect(await screen.findByText("Scrivi il nome dell'articolo")).toBeInTheDocument()
    expect(h.crea).not.toHaveBeenCalled()
  })

  it('giacenza iniziale non valida (mezzi pezzi): errore e nessun salvataggio', async () => {
    await apriForm()
    await userEvent.type(screen.getByLabelText('Nome'), 'Stoppini')
    await userEvent.type(screen.getByLabelText(/Giacenza iniziale/), '2,5')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al magazzino' }))
    expect(await screen.findByText(/giacenza iniziale non è valida in pezzi/i)).toBeInTheDocument()
    expect(h.crea).not.toHaveBeenCalled()
  })

  it('dopo il salvataggio il modulo si chiude', async () => {
    await apriForm()
    await userEvent.type(screen.getByLabelText('Nome'), 'Nastro')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al magazzino' }))
    expect(screen.queryByRole('form', { name: 'Nuovo articolo' })).not.toBeInTheDocument()
  })

  it('se il salvataggio fallisce si vede l\'errore e il modulo resta', async () => {
    h.crea.mockImplementation(async () => {
      throw new Error('offline')
    })
    await apriForm()
    await userEvent.type(screen.getByLabelText('Nome'), 'Nastro')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al magazzino' }))
    expect(await screen.findByText(/Non sono riuscito a salvare/)).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Nuovo articolo' })).toBeInTheDocument()
  })
})

describe('movimenti', () => {
  it('Gestisci apre e chiude il pannello', async () => {
    apri()
    const pulsante = within(scheda('Cera di soia')).getByRole('button', { name: /Gestisci Cera di soia/ })
    expect(pulsante).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(pulsante)
    expect(pulsante).toHaveAttribute('aria-expanded', 'true')
    expect(within(scheda('Cera di soia')).getByLabelText('Quantità (in kg)')).toBeInTheDocument()
    await userEvent.click(pulsante)
    expect(within(scheda('Cera di soia')).queryByLabelText('Quantità (in kg)')).not.toBeInTheDocument()
  })

  it('carico di 1,5 kg: viene mandato in unità base (1500 g) con la nota', async () => {
    apri()
    await gestisci('Cera di soia')
    const s = within(scheda('Cera di soia'))
    await userEvent.type(s.getByLabelText('Quantità (in kg)'), '1,5')
    await userEvent.type(s.getByLabelText('Nota (facoltativa)'), 'Acquisto fornitore')
    await userEvent.click(s.getByRole('button', { name: 'Aggiungi (carico)' }))
    expect(h.registra).toHaveBeenCalledWith('a1', 'carico', 1500, 'Acquisto fornitore')
    expect(await s.findByText('Movimento registrato')).toBeInTheDocument()
    expect(s.getByLabelText('Quantità (in kg)')).toHaveValue('')
  })

  it('scarico di 20 g da un articolo in grammi', async () => {
    h.articoli = [{ ...cera, unita: 'g' }]
    apri()
    await gestisci('Cera di soia')
    const s = within(scheda('Cera di soia'))
    await userEvent.type(s.getByLabelText('Quantità (in g)'), '20')
    await userEvent.click(s.getByRole('button', { name: 'Togli (scarico)' }))
    expect(h.registra).toHaveBeenCalledWith('a1', 'scarico', 20, '')
  })

  it('imposta la giacenza (inventario)', async () => {
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    await userEvent.type(s.getByLabelText('Quantità (in pezzi)'), '40')
    await userEvent.click(s.getByRole('button', { name: 'Imposta giacenza' }))
    expect(h.registra).toHaveBeenCalledWith('a2', 'rettifica', 40, '')
  })

  it('una quantità non valida non parte e spiega come scriverla', async () => {
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    await userEvent.type(s.getByLabelText('Quantità (in pezzi)'), '2,5')
    await userEvent.click(s.getByRole('button', { name: 'Aggiungi (carico)' }))
    expect(await s.findByText(/Scrivi una quantità valida in pezzi: un numero intero/)).toBeInTheDocument()
    expect(h.registra).not.toHaveBeenCalled()
  })

  it('quantità vuota o con lettere non parte', async () => {
    apri()
    await gestisci('Cera di soia')
    const s = within(scheda('Cera di soia'))
    await userEvent.click(s.getByRole('button', { name: 'Togli (scarico)' }))
    expect(await s.findByText(/Scrivi una quantità valida in kg/)).toBeInTheDocument()
    expect(h.registra).not.toHaveBeenCalled()
  })

  it('uno scarico oltre la giacenza mostra il motivo della regola', async () => {
    h.registra.mockImplementation(async () => {
      throw new ErroreRegola('Non basta: ne restano 1 pezzo.')
    })
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    await userEvent.type(s.getByLabelText('Quantità (in pezzi)'), '5')
    await userEvent.click(s.getByRole('button', { name: 'Togli (scarico)' }))
    expect(await s.findByText('Non basta: ne restano 1 pezzo.')).toBeInTheDocument()
    expect(s.queryByText('Movimento registrato')).not.toBeInTheDocument()
  })

  it('un guasto generico mostra il messaggio sulla connessione', async () => {
    h.registra.mockImplementation(async () => {
      throw new Error('offline')
    })
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    await userEvent.type(s.getByLabelText('Quantità (in pezzi)'), '5')
    await userEvent.click(s.getByRole('button', { name: 'Aggiungi (carico)' }))
    expect(await s.findByText(/Non sono riuscito a salvare/)).toBeInTheDocument()
  })

  it('lo storico elenca i movimenti con data e nota, o dice che non ce ne sono', async () => {
    apri()
    await gestisci('Cera di soia')
    expect(within(scheda('Cera di soia')).getByText('Nessun movimento registrato.')).toBeInTheDocument()
  })

  it('lo storico mostra i movimenti dell\'articolo', async () => {
    h.movimenti = [
      {
        id: 'm1',
        articoloId: 'a1',
        articoloNome: 'Cera di soia',
        tipo: 'carico',
        delta: 2000,
        giacenzaDopo: 2500,
        unita: 'kg',
        nota: 'Acquisto fornitore',
        data: '2026-11-20',
        creatoIl: '2026-11-20T10:00:00.000Z',
      },
      {
        id: 'm2',
        articoloId: 'a1',
        articoloNome: 'Cera di soia',
        tipo: 'scarico',
        delta: -500,
        giacenzaDopo: 2000,
        unita: 'kg',
        data: '2026-11-22',
        creatoIl: '2026-11-22T09:00:00.000Z',
      },
    ]
    apri()
    await gestisci('Cera di soia')
    const s = within(scheda('Cera di soia'))
    expect(s.getByText('Carico +2 kg → ora 2,5 kg')).toBeInTheDocument()
    expect(s.getByText(/20\/11\/2026 · Acquisto fornitore/)).toBeInTheDocument()
    expect(s.getByText('Scarico -500 g → ora 2 kg')).toBeInTheDocument()
  })
})

describe('modifica articolo', () => {
  it('cambia nome e passa da grammi a chili (stessa famiglia) anche con giacenza', async () => {
    h.articoli = [{ ...cera, unita: 'g' }]
    apri()
    await gestisci('Cera di soia')
    const s = within(scheda('Cera di soia'))
    const nome = s.getByLabelText('Nome', { selector: '#mn-a1' })
    await userEvent.clear(nome)
    await userEvent.type(nome, 'Cera di soia bio')
    await userEvent.selectOptions(s.getByLabelText('Unità di misura', { selector: '#mu-a1' }), 'kg')
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(h.aggiorna).toHaveBeenCalledWith('a1', { nome: 'Cera di soia bio', tipo: 'materiale', unita: 'kg', attivo: true })
  })

  it('da pezzi a grammi con giacenza: bloccato con spiegazione; a giacenza zero si può', async () => {
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    await userEvent.selectOptions(s.getByLabelText('Unità di misura', { selector: '#mu-a2' }), 'g')
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(await s.findByText(/finché c'è giacenza/)).toBeInTheDocument()
    expect(h.aggiorna).not.toHaveBeenCalled()
  })

  it('a giacenza zero si può cambiare famiglia', async () => {
    h.articoli = [{ ...stoppini, giacenza: 0 }]
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    await userEvent.selectOptions(s.getByLabelText('Unità di misura', { selector: '#mu-a2' }), 'g')
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(h.aggiorna).toHaveBeenCalledWith('a2', expect.objectContaining({ unita: 'g' }))
  })

  it('un prodotto senza prezzo non si salva', async () => {
    apri()
    await gestisci('Candela grande')
    const s = within(scheda('Candela grande'))
    await userEvent.clear(s.getByLabelText(/Prezzo di vendita/))
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(await s.findByText('Un prodotto ha bisogno del prezzo di vendita')).toBeInTheDocument()
    expect(h.aggiorna).not.toHaveBeenCalled()
  })

  it('cambia il prezzo di un prodotto', async () => {
    apri()
    await gestisci('Candela grande')
    const s = within(scheda('Candela grande'))
    const prezzo = s.getByLabelText(/Prezzo di vendita/)
    await userEvent.clear(prezzo)
    await userEvent.type(prezzo, '9')
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(h.aggiorna).toHaveBeenCalledWith('a3', { nome: 'Candela grande', tipo: 'prodotto', unita: 'pezzi', attivo: true, prezzoCent: 900 })
  })

  it('disattivare un articolo con giacenza chiede conferma e dice quanto ne resta', async () => {
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    const conferma = vi.spyOn(window, 'confirm')
    conferma.mockReturnValueOnce(false)
    await userEvent.click(s.getByLabelText(/In uso/))
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(h.aggiorna).not.toHaveBeenCalled()
    conferma.mockReturnValueOnce(true)
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(conferma).toHaveBeenLastCalledWith(expect.stringContaining('ne restano 1 pezzo'))
    expect(h.aggiorna).toHaveBeenCalledWith('a2', expect.objectContaining({ attivo: false }))
  })

  it('disattivare un articolo finito (giacenza zero) non chiede conferma', async () => {
    h.articoli = [{ ...stoppini, giacenza: 0 }]
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    const conferma = vi.spyOn(window, 'confirm')
    conferma.mockClear()
    await userEvent.click(s.getByLabelText(/In uso/))
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(conferma).not.toHaveBeenCalled()
    expect(h.aggiorna).toHaveBeenCalledWith('a2', expect.objectContaining({ attivo: false }))
  })

  it('un Materiale in chili con giacenza non diventa Prodotto: i prodotti sono a pezzi e la famiglia non cambia', async () => {
    apri()
    await gestisci('Cera di soia')
    const s = within(scheda('Cera di soia'))
    await userEvent.selectOptions(s.getByLabelText('Tipo', { selector: '#mt-a1' }), 'prodotto')
    expect(s.getByLabelText('Unità di misura', { selector: '#mu-a1' })).toHaveValue('pezzi')
    await userEvent.type(s.getByLabelText(/Prezzo di vendita/), '5')
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(await s.findByText(/finché c'è giacenza/)).toBeInTheDocument()
    expect(h.aggiorna).not.toHaveBeenCalled()
  })

  it('il nome non può restare vuoto', async () => {
    apri()
    await gestisci('Stoppini')
    const s = within(scheda('Stoppini'))
    await userEvent.clear(s.getByLabelText('Nome', { selector: '#mn-a2' }))
    await userEvent.click(s.getByRole('button', { name: 'Salva modifiche' }))
    expect(await s.findByText("Scrivi il nome dell'articolo")).toBeInTheDocument()
    expect(h.aggiorna).not.toHaveBeenCalled()
  })
})

describe('con molti articoli', () => {
  it('mostra i primi 15 e "Mostra altri"; cambiando ricerca si riparte dall\'inizio', async () => {
    h.articoli = Array.from({ length: 40 }, (_, i) => ({
      id: `m${i}`,
      nome: `Articolo ${String(i).padStart(2, '0')}`,
      tipo: 'materiale' as const,
      unita: 'pezzi' as const,
      giacenza: i,
      attivo: true,
    }))
    apri()
    expect(screen.getAllByRole('article')).toHaveLength(15)
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 15 (ne restano 25)' }))
    expect(screen.getAllByRole('article')).toHaveLength(30)
    await userEvent.type(screen.getByLabelText('Cerca nel magazzino'), 'articolo')
    expect(screen.getAllByRole('article')).toHaveLength(15)
  })
})

describe('ricetta nella scheda del prodotto', () => {
  it('un Prodotto ha la sezione Ricetta, un Materiale no', async () => {
    apri()
    await gestisci('Candela grande')
    expect(within(scheda('Candela grande')).getByLabelText('Ricetta di Candela grande')).toBeInTheDocument()
    await gestisci('Cera di soia')
    expect(within(scheda('Cera di soia')).queryByLabelText(/Ricetta di/)).not.toBeInTheDocument()
  })

  it('i materiali della lista si possono mettere in ricetta e il salvataggio parte dalla scheda', async () => {
    apri()
    await gestisci('Candela grande')
    const s = within(scheda('Candela grande'))
    await userEvent.selectOptions(s.getByLabelText('Aggiungi un materiale'), 'a1') // Cera di soia, in kg
    await userEvent.type(s.getByLabelText('Quantità per pezzo'), '200')
    await userEvent.click(s.getByRole('button', { name: '+ Aggiungi alla ricetta' }))
    await userEvent.click(s.getByRole('button', { name: 'Salva ricetta' }))
    expect(h.aggiorna).toHaveBeenCalledWith('a3', { ricetta: [{ articoloId: 'a1', quantita: 200 }] })
  })
})
