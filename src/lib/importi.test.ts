import { centInEuroTesto, parseEuro } from './importi'

it.each([
  ['3,50', 350],
  ['3.5', 350],
  ['1.250,00', 125000],
  ['10', 1000],
  ['0,30', 30],
  ['€ 2,5', 250],
])('parseEuro(%s)', (t, c) => expect(parseEuro(t)).toBe(c))

it.each(['', 'abc', '-3', '1,234'])('parseEuro non valido: %s', (t) => expect(parseEuro(t)).toBeNull())
it('centInEuroTesto', () => expect(centInEuroTesto(1750)).toBe('17,50'))
