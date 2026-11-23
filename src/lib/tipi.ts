export type Canale = 'TikTok' | 'WhatsApp' | 'Instagram' | 'Facebook' | 'Altro'
export type StatoOrdine =
  | 'in attesa acconto'
  | 'confermato'
  | 'in preparazione'
  | 'pronto'
  | 'spedito'
  | 'consegnato'
  | 'annullato'
export type MetodoPagamento = 'contanti' | 'bonifico' | 'paypal' | 'altro'

export const CANALI: Canale[] = ['TikTok', 'WhatsApp', 'Instagram', 'Facebook', 'Altro']
export const STATI: StatoOrdine[] = [
  'in attesa acconto',
  'confermato',
  'in preparazione',
  'pronto',
  'spedito',
  'consegnato',
  'annullato',
]
export const ETICHETTE_STATO: Record<StatoOrdine, string> = {
  'in attesa acconto': 'In attesa di acconto',
  confermato: 'Confermato',
  'in preparazione': 'In preparazione',
  pronto: 'Pronto da spedire',
  spedito: 'Spedito',
  consegnato: 'Consegnato',
  annullato: 'Annullato',
}
export const METODI: MetodoPagamento[] = ['contanti', 'bonifico', 'paypal', 'altro']
export const ETICHETTE_METODO: Record<MetodoPagamento, string> = {
  contanti: 'Contanti',
  bonifico: 'Bonifico',
  paypal: 'PayPal',
  altro: 'Altro',
}

import type { Unita } from './unita'

export type TipoArticolo = 'materiale' | 'prodotto'
export const TIPI_ARTICOLO: TipoArticolo[] = ['materiale', 'prodotto']
export const ETICHETTE_TIPO: Record<TipoArticolo, string> = { materiale: 'Materiale', prodotto: 'Prodotto' }

/** Un articolo del magazzino. La giacenza è in unità BASE intera (g, ml, cm, pezzi). */
export interface Articolo {
  id: string
  nome: string
  tipo: TipoArticolo
  unita: Unita
  giacenza: number
  prezzoCent?: number // prezzo di vendita: solo per i Prodotti
  attivo: boolean
  note?: string
}

export type TipoMovimento = 'carico' | 'scarico' | 'rettifica'
export const ETICHETTE_MOVIMENTO: Record<TipoMovimento, string> = { carico: 'Carico', scarico: 'Scarico', rettifica: 'Correzione' }

export interface Movimento {
  id: string
  articoloId: string
  articoloNome: string
  tipo: TipoMovimento
  delta: number // variazione in unità base (negativa per gli scarichi)
  giacenzaDopo: number
  unita: Unita
  nota?: string
  data: string // YYYY-MM-DD
  creatoIl: string
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
  notePreparazione?: string
  corriere?: string
  tracking?: string
  dataSpedizione?: string // YYYY-MM-DD
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
