import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Briciole } from './Briciole'
import { MostraAltri, usePaginazione } from './Paginazione'
import { Sezione } from './Sezione'

describe('Sezione che si ricorda', () => {
  it('senza "ricorda" riparte sempre dal valore iniziale', async () => {
    const { unmount } = render(<Sezione titolo="A"><p>dentro</p></Sezione>)
    await userEvent.click(screen.getByRole('button', { name: /A/ }))
    unmount()
    render(<Sezione titolo="A"><p>dentro</p></Sezione>)
    expect(screen.getByRole('button', { name: /A/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('con "ricorda" la scelta resta quando si torna sulla pagina', async () => {
    const { unmount } = render(<Sezione titolo="Pagamenti" aperta ricorda="prova:pagamenti"><p>dentro</p></Sezione>)
    await userEvent.click(screen.getByRole('button', { name: /Pagamenti/ })) // la chiudo
    unmount()
    render(<Sezione titolo="Pagamenti" aperta ricorda="prova:pagamenti"><p>dentro</p></Sezione>)
    expect(screen.getByRole('button', { name: /Pagamenti/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('ricorda anche quando la apro', async () => {
    const { unmount } = render(<Sezione titolo="Link" ricorda="prova:link"><p>dentro</p></Sezione>)
    await userEvent.click(screen.getByRole('button', { name: /Link/ }))
    unmount()
    render(<Sezione titolo="Link" ricorda="prova:link"><p>dentro</p></Sezione>)
    expect(screen.getByRole('button', { name: /Link/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('dentro')).toBeInTheDocument()
  })

  it('sezioni con nomi diversi non si mescolano', async () => {
    const { unmount } = render(<Sezione titolo="X" ricorda="prova:x"><p>x</p></Sezione>)
    await userEvent.click(screen.getByRole('button', { name: /X/ }))
    unmount()
    render(<Sezione titolo="Y" ricorda="prova:y"><p>y</p></Sezione>)
    expect(screen.getByRole('button', { name: /Y/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('se la memoria del browser non è disponibile funziona lo stesso', async () => {
    const leggi = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccata')
    })
    const scrivi = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloccata')
    })
    render(<Sezione titolo="Z" ricorda="prova:z"><p>dentro</p></Sezione>)
    await userEvent.click(screen.getByRole('button', { name: /Z/ }))
    expect(screen.getByText('dentro')).toBeInTheDocument()
    leggi.mockRestore()
    scrivi.mockRestore()
  })
})

describe('Sezione', () => {
  it('è chiusa all\'inizio: il contenuto non c\'è finché non la apri', async () => {
    render(<Sezione titolo="Pagamenti"><p>Contenuto segreto</p></Sezione>)
    const pulsante = screen.getByRole('button', { name: /Pagamenti/ })
    expect(pulsante).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Contenuto segreto')).not.toBeInTheDocument()
    await userEvent.click(pulsante)
    expect(pulsante).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Contenuto segreto')).toBeInTheDocument()
    await userEvent.click(pulsante)
    expect(screen.queryByText('Contenuto segreto')).not.toBeInTheDocument()
  })

  it('può partire aperta', () => {
    render(<Sezione titolo="Ordini" aperta><p>Visibile subito</p></Sezione>)
    expect(screen.getByText('Visibile subito')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ordini/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('mostra il conteggio nel titolo', () => {
    render(<Sezione titolo="Ordini" conteggio={12}><p>x</p></Sezione>)
    expect(screen.getByRole('button', { name: 'Ordini (12)' })).toBeInTheDocument()
  })

  it('il pulsante è un titolo di sezione (si salta con la tastiera o con la lettura vocale)', () => {
    render(<Sezione titolo="Filtri"><p>x</p></Sezione>)
    expect(screen.getByRole('heading', { level: 2, name: /Filtri/ })).toBeInTheDocument()
  })
})

function Lista({ n, chiave = '' }: { n: number; chiave?: string }) {
  const elementi = Array.from({ length: n }, (_, i) => `Elemento ${i + 1}`)
  const { visibili, resto, mostraAltri } = usePaginazione(elementi, 15, chiave)
  return (
    <div>
      <ul>{visibili.map((e) => <li key={e}>{e}</li>)}</ul>
      <MostraAltri resto={resto} onClick={mostraAltri} />
    </div>
  )
}

describe('Paginazione', () => {
  it('mostra i primi 15 e poi altri a blocchi', async () => {
    render(<Lista n={40} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(15)
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 15 (ne restano 25)' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(30)
    await userEvent.click(screen.getByRole('button', { name: 'Mostra altri 10 (ne restano 10)' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(40)
    expect(screen.queryByRole('button', { name: /Mostra altri/ })).not.toBeInTheDocument()
  })

  it('una lista corta non mostra il pulsante', () => {
    render(<Lista n={15} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(15)
    expect(screen.queryByRole('button', { name: /Mostra altri/ })).not.toBeInTheDocument()
  })

  it('una lista vuota non si rompe', () => {
    render(<Lista n={0} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('ricomincia dall\'inizio quando cambia un filtro', async () => {
    function Prova() {
      const [filtro, setFiltro] = useState('a')
      return (
        <>
          <button onClick={() => setFiltro('b')}>Cambia filtro</button>
          <Lista n={40} chiave={filtro} />
        </>
      )
    }
    render(<Prova />)
    await userEvent.click(screen.getByRole('button', { name: /Mostra altri 15/ }))
    expect(screen.getAllByRole('listitem')).toHaveLength(30)
    await userEvent.click(screen.getByRole('button', { name: 'Cambia filtro' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(15)
  })
})

describe('Briciole', () => {
  it('mostra il percorso con i collegamenti e la pagina corrente senza link', () => {
    render(
      <MemoryRouter>
        <Briciole voci={[{ testo: 'Ordini', a: '/ordini' }, { testo: 'Maria Rossi', a: '/clienti/c1' }, { testo: 'n. 7' }]} />
      </MemoryRouter>,
    )
    const percorso = screen.getByRole('navigation', { name: 'Percorso' })
    expect(percorso).toHaveTextContent('Ordini')
    expect(screen.getByRole('link', { name: 'Ordini' })).toHaveAttribute('href', '/ordini')
    expect(screen.getByRole('link', { name: 'Maria Rossi' })).toHaveAttribute('href', '/clienti/c1')
    expect(screen.queryByRole('link', { name: 'n. 7' })).not.toBeInTheDocument()
    expect(screen.getByText('n. 7').closest('li')).toHaveAttribute('aria-current', 'page')
  })
})
