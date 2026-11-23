import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Account from './Account'

const h = vi.hoisted(() => ({
  cambia: (async () => {}) as (a: string, n: string) => Promise<void>,
  chiamate: [] as [string, string][],
  esci: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    utente: { email: 'persona@example.com' },
    cambiaPassword: (a: string, n: string) => {
      h.chiamate.push([a, n])
      return h.cambia(a, n)
    },
    esci: h.esci,
  }),
}))

beforeEach(() => {
  h.chiamate = []
  h.cambia = async () => {}
  h.esci.mockReset()
})

async function compila(attuale: string, nuova: string, conferma: string) {
  await userEvent.type(screen.getByLabelText('Password attuale'), attuale)
  await userEvent.type(screen.getByLabelText(/^Nuova password/), nuova)
  await userEvent.type(screen.getByLabelText('Ripeti la nuova password'), conferma)
  await userEvent.click(screen.getByRole('button', { name: 'Cambia password' }))
}

it('mostra l\'email dell\'utente collegato', () => {
  render(<Account />)
  expect(screen.getByText('persona@example.com')).toBeInTheDocument()
})

it('cambia la password e svuota i campi', async () => {
  render(<Account />)
  await compila('vecchia-pass', 'nuova-pass-1', 'nuova-pass-1')
  expect(await screen.findByText('Password cambiata')).toBeInTheDocument()
  expect(h.chiamate).toEqual([['vecchia-pass', 'nuova-pass-1']])
  expect(screen.getByLabelText('Password attuale')).toHaveValue('')
})

it('password nuova troppo corta: non chiama Firebase', async () => {
  render(<Account />)
  await compila('vecchia-pass', 'corta', 'corta')
  expect(await screen.findByText(/almeno 8 caratteri/, { selector: '[role="alert"]' })).toBeInTheDocument()
  expect(h.chiamate).toEqual([])
})

it('le due password nuove devono coincidere', async () => {
  render(<Account />)
  await compila('vecchia-pass', 'nuova-pass-1', 'nuova-pass-2')
  expect(await screen.findByText('Le due password nuove non coincidono')).toBeInTheDocument()
  expect(h.chiamate).toEqual([])
})

it('la nuova password deve essere diversa dall\'attuale', async () => {
  render(<Account />)
  await compila('stessa-pass-1', 'stessa-pass-1', 'stessa-pass-1')
  expect(await screen.findByText('La nuova password deve essere diversa da quella attuale')).toBeInTheDocument()
  expect(h.chiamate).toEqual([])
})

it('password attuale sbagliata: messaggio chiaro e nessun "Password cambiata"', async () => {
  h.cambia = async () => {
    throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' })
  }
  render(<Account />)
  await compila('sbagliata-1', 'nuova-pass-1', 'nuova-pass-1')
  expect(await screen.findByText('La password attuale non è corretta')).toBeInTheDocument()
  expect(screen.queryByText('Password cambiata')).not.toBeInTheDocument()
})

it('troppi tentativi', async () => {
  h.cambia = async () => {
    throw Object.assign(new Error('x'), { code: 'auth/too-many-requests' })
  }
  render(<Account />)
  await compila('vecchia-pass', 'nuova-pass-1', 'nuova-pass-1')
  expect(await screen.findByText(/Troppi tentativi/)).toBeInTheDocument()
})

it('Esci', async () => {
  render(<Account />)
  await userEvent.click(screen.getByRole('button', { name: 'Esci' }))
  expect(h.esci).toHaveBeenCalledTimes(1)
})
