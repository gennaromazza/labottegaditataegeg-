import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

it('mostra_il_titolo_della_bottega', () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByText(/La Bottega/)).toBeInTheDocument()
})
