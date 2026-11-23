import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Guscio } from './Guscio'

const h = vi.hoisted(() => ({ esci: vi.fn() }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ esci: h.esci }) }))

const apri = (percorso: string) =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <Routes>
        <Route element={<Guscio />}>
          <Route path="/ordini" element={<p>pagina ordini</p>} />
          <Route path="/spese" element={<p>pagina spese</p>} />
          <Route path="/account" element={<p>pagina account</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

it('il menu ha tutte le sezioni, ognuna con un nome leggibile', () => {
  apri('/ordini')
  const menu = screen.getByRole('navigation', { name: 'Menu principale' })
  const nomi = within(menu).getAllByRole('link').map((a) => a.textContent)
  expect(nomi).toEqual(['Ordini', 'Clienti', 'Incassi', 'Spese', 'Listino', 'Account'])
})

it('le icone sono decorative e non si leggono due volte', () => {
  apri('/ordini')
  const icone = document.querySelectorAll('.menu a svg')
  expect(icone).toHaveLength(6)
  icone.forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'))
})

it('la sezione aperta è evidenziata e segnalata come pagina corrente', () => {
  apri('/spese')
  const corrente = screen.getByRole('link', { current: 'page' })
  expect(corrente).toHaveTextContent('Spese')
  expect(corrente).toHaveClass('attiva')
  expect(screen.getByRole('link', { name: 'Ordini' })).not.toHaveClass('attiva')
})

it('toccare una voce cambia pagina', async () => {
  apri('/ordini')
  await userEvent.click(screen.getByRole('link', { name: 'Account' }))
  expect(screen.getByText('pagina account')).toBeInTheDocument()
})

it('Esci chiude la sessione', async () => {
  apri('/ordini')
  await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
  expect(h.esci).toHaveBeenCalledTimes(1)
})
