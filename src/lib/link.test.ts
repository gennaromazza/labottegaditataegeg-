import { linkOrdine } from './link'

it('costruisce il link dell\'ordine', () => {
  expect(linkOrdine('abc123', 'https://labottega-tata-gege.web.app')).toBe('https://labottega-tata-gege.web.app/ordini/abc123')
})
it('toglie la barra finale e codifica l\'id', () => {
  expect(linkOrdine('a/b c', 'https://x.it/')).toBe('https://x.it/ordini/a%2Fb%20c')
})
it('senza origine usa quella della pagina', () => {
  expect(linkOrdine('z')).toBe(`${window.location.origin}/ordini/z`)
})
