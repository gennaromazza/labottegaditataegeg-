export type Canale = 'TikTok' | 'WhatsApp' | 'Instagram' | 'Facebook' | 'Altro'
export type StatoOrdine = 'da fare' | 'in lavorazione' | 'pronto' | 'consegnato' | 'annullato'
export type MetodoPagamento = 'contanti' | 'bonifico' | 'paypal' | 'altro'

export const CANALI: Canale[] = ['TikTok', 'WhatsApp', 'Instagram', 'Facebook', 'Altro']
export const STATI: StatoOrdine[] = ['da fare', 'in lavorazione', 'pronto', 'consegnato', 'annullato']
export const METODI: MetodoPagamento[] = ['contanti', 'bonifico', 'paypal', 'altro']
export const ETICHETTE_METODO: Record<MetodoPagamento, string> = {
  contanti: 'Contanti',
  bonifico: 'Bonifico',
  paypal: 'PayPal',
  altro: 'Altro',
}

export type CategoriaSpesa = 'Materiali' | 'Spedizioni' | 'Imballaggi' | 'Attrezzatura' | 'Pubblicità' | 'Rimborsi' | 'Altro'
export const CATEGORIE_SPESA: CategoriaSpesa[] = ['Materiali', 'Spedizioni', 'Imballaggi', 'Attrezzatura', 'Pubblicità', 'Rimborsi', 'Altro']

export interface Spesa {
  id: string
  descrizione: string
  importoCent: number
  data: string // YYYY-MM-DD
  categoria: CategoriaSpesa
  note?: string
}

export interface Riga {
  descrizione: string
  testoPersonalizzato?: string
  quantita: number
  prezzoUnitarioCent: number
}

export interface Pagamento {
  importoCent: number
  data: string // YYYY-MM-DD
  metodo?: MetodoPagamento
}

export interface Ordine {
  id: string
  numero: number
  clienteId: string
  clienteNome: string
  clienteTelefono?: string
  canale: Canale
  righe: Riga[]
  stato: StatoOrdine
  dataConsegna?: string
  note?: string
  creatoIl: string
  pagamenti: Pagamento[]
}

export interface Spedizione {
  destinatario?: string // se diverso dal cliente
  indirizzo: string
  cap: string
  citta: string
  provincia: string
}

export interface Cliente {
  id: string
  nome: string
  telefono?: string
  note?: string
  spedizione?: Spedizione
}
