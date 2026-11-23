import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Altro from './Altro'

const h = vi.hoisted(() => ({ esci: vi.fn() }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ esci: h.esci }) }))

const apri = () =>
  render(
    <MemoryRouter>
      <Altro />
    </MemoryRouter>,
  )

it('raccoglie Spese, Magazzino e Account', () => {
  apri()
  expect(screen.getByRole('link', { name: /^Spese/ })).toHaveAttribute('href', '/spese')
  expect(screen.getByRole('link', { name: /^Magazzino/ })).toHaveAttribute('href', '/magazzino')
  expect(screen.getByRole('link', { name: /^Account/ })).toHaveAttribute('href', '/account')
})

it('ha il pulsante Esci', async () => {
  apri()
  await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
  expect(h.esci).toHaveBeenCalledTimes(1)
})
