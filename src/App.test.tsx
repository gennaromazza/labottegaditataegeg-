import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

vi.mock('./firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null)
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

it('mostra_il_titolo_della_bottega', () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByText(/Tratti di Bottega/)).toBeInTheDocument()
})
