import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

const h = vi.hoisted(() => ({
  listener: null as null | ((u: unknown) => void),
  signIn: (async () => {}) as (...a: unknown[]) => Promise<void>,
}))

vi.mock('../firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => {
    h.listener = cb
    cb(null)
    return () => {}
  },
  signInWithEmailAndPassword: (...a: unknown[]) => h.signIn(...a),
  signOut: vi.fn(),
}))

function apri(percorso: string) {
  return render(
    <MemoryRouter initialEntries={[percorso]}>
      <App />
    </MemoryRouter>,
  )
}


it('senza utente /ordini porta al login', async () => {
  apri('/ordini')
  expect(await screen.findByRole('button', { name: 'Accedi' })).toBeInTheDocument()
})

it('credenziali errate mostrano il messaggio', async () => {
  h.signIn = async () => {
    throw new Error('auth/invalid-credential')
  }
  apri('/login')
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.it')
  await userEvent.type(screen.getByLabelText('Password'), 'sbagliata')
  await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))
  expect(await screen.findByText('Email o password non corretti')).toBeInTheDocument()
})

it('login riuscito porta agli ordini', async () => {
  h.signIn = async () => {
    h.listener?.({ email: 'a@b.it' })
  }
  apri('/login')
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.it')
  await userEvent.type(screen.getByLabelText('Password'), 'giusta')
  await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Ordini' })).toBeInTheDocument())
})
