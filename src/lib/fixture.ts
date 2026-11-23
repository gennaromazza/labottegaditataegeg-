import type { Ordine } from './tipi'

export function ordineDiProva(extra: Partial<Ordine> = {}): Ordine {
  return {
    id: 'o1',
    numero: 7,
    clienteId: 'c1',
    clienteNome: 'Maria Rossi',
    clienteTelefono: '333 123-4567',
    canale: 'WhatsApp',
    righe: [
      { descrizione: 'Segnaposto', testoPersonalizzato: 'Mario', quantita: 3, prezzoUnitarioCent: 250 },
      { descrizione: 'Candela', quantita: 1, prezzoUnitarioCent: 1000 },
    ],
    stato: 'da fare',
    creatoIl: '2026-11-01',
    pagamenti: [],
    ...extra,
  }
}
