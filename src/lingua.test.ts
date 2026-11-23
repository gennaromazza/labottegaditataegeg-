import html from '../index.html?raw'
import { ETICHETTE_METODO, METODI } from './lib/tipi'

// Con lang="en" il browser del telefono propone di tradurre e storpia le voci ("contanti" diventava "tazze").
it('la pagina è dichiarata in italiano e non si traduce da sola', () => {
  expect(html).toMatch(/<html[^>]*\blang="it"/)
  expect(html).toMatch(/<html[^>]*\btranslate="no"/)
  expect(html).toMatch(/<meta name="google" content="notranslate"/)
})

it('ogni metodo di pagamento ha un\'etichetta in italiano', () => {
  expect(METODI.map((m) => ETICHETTE_METODO[m])).toEqual(['Contanti', 'Bonifico', 'PayPal', 'Altro'])
})
