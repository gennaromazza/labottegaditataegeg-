import { caricaComuni, cercaPerCap, cercaPerNome, normalizza, type Comune } from './comuni'

let comuni: Comune[]
beforeAll(async () => {
  comuni = await caricaComuni()
})

it('carica i comuni italiani', () => {
  expect(comuni.length).toBeGreaterThan(7000)
})

describe('cercaPerCap', () => {
  it('un CAP di un solo comune', () => {
    expect(cercaPerCap(comuni, '81031').map((c) => `${c[0]} ${c[1]}`)).toEqual(['Aversa CE'])
  })
  it('un CAP condiviso da più comuni li restituisce tutti', () => {
    const nomi = cercaPerCap(comuni, '26834').map((c) => c[0])
    expect(nomi).toEqual(expect.arrayContaining(['Abbadia Cerreto', 'Corte Palasio']))
  })
  it('un CAP sconosciuto non trova nulla', () => expect(cercaPerCap(comuni, '00000')).toEqual([]))
})

describe('cercaPerNome', () => {
  it('prima chi inizia con il testo', () => {
    expect(cercaPerNome(comuni, 'avers')[0][0]).toBe('Aversa')
  })
  it('ignora accenti e maiuscole', () => {
    expect(cercaPerNome(comuni, 'FORLI').some((c) => c[0] === 'Forlì')).toBe(true)
  })
  it('gestisce gli apostrofi', () => {
    expect(cercaPerNome(comuni, "sant'angelo").length).toBeGreaterThan(0)
  })
  it('omonimi in province diverse restano distinguibili', () => {
    const castro = cercaPerNome(comuni, 'castro').filter((c) => c[0] === 'Castro')
    expect(new Set(castro.map((c) => c[1])).size).toBeGreaterThanOrEqual(2)
  })
  it('meno di 2 caratteri o troppi risultati: vuoto o limitato', () => {
    expect(cercaPerNome(comuni, 'a')).toEqual([])
    expect(cercaPerNome(comuni, 'san', 5)).toHaveLength(5)
  })
})

it('normalizza', () => expect(normalizza("  Sant'Àngelo  ")).toBe('sant angelo'))
