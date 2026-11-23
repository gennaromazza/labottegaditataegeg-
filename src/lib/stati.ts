import { versatoCent } from './calcoli'
import { STATI, type Ordine, type StatoOrdine } from './tipi'

/** Stati che richiedono almeno un acconto: senza, l'ordine non procede. */
const RICHIEDONO_ACCONTO = new Set<StatoOrdine>(['confermato', 'in preparazione', 'pronto', 'spedito', 'consegnato'])

export const MOTIVO_ACCONTO = 'Senza un acconto non si procede: registra prima un pagamento.'

/** Un ordine nasce confermato se ha già un acconto, altrimenti aspetta. */
export function statoIniziale(versato: number): StatoOrdine {
  return versato > 0 ? 'confermato' : 'in attesa acconto'
}

/**
 * Legge lo stato di un ordine. "In attesa di acconto" e "Confermato" seguono i pagamenti da soli:
 * con un acconto registrato l'ordine è confermato, senza non lo è. Gli ordini creati con i vecchi
 * stati ("da fare", "in lavorazione") si leggono con quelli nuovi.
 */
export function normalizzaStato(raw: string, versato: number): StatoOrdine {
  let stato: StatoOrdine
  if ((STATI as string[]).includes(raw)) stato = raw as StatoOrdine
  else if (raw === 'in lavorazione') stato = 'in preparazione'
  else stato = statoIniziale(versato)
  if (stato === 'in attesa acconto' && versato > 0) return 'confermato'
  if (stato === 'confermato' && versato <= 0) return 'in attesa acconto'
  return stato
}

/** Dopo un nuovo pagamento: un ordine che aspettava l'acconto diventa confermato. null = lo stato resta com'è. */
export function statoDopoNuovoPagamento(statoAttuale: string, versatoOra: number): StatoOrdine | null {
  if (versatoOra <= 0) return null
  return statoAttuale === 'in attesa acconto' || statoAttuale === 'da fare' ? 'confermato' : null
}

/** Stati in cui l'ordine non è ancora partito: lì lo stato segue i pagamenti. */
const PRIMA_DELLA_SPEDIZIONE = ['confermato', 'in preparazione', 'in lavorazione', 'pronto']

/** Dopo aver tolto un pagamento: se era l'unico e l'ordine non è ancora partito, torna in attesa di acconto da solo. */
export function statoDopoRimozionePagamento(statoAttuale: string, versatoRimasto: number): StatoOrdine | null {
  if (versatoRimasto > 0) return null
  return PRIMA_DELLA_SPEDIZIONE.includes(statoAttuale) ? 'in attesa acconto' : null
}

/** Errore di una regola di lavoro (non un guasto): il messaggio si può mostrare così com'è. */
export class ErroreRegola extends Error {}

/** L'unico pagamento di un ordine già partito non si toglie: sarebbe un ordine spedito senza acconto. */
export function rimozionePermessa(statoAttuale: string, versatoRimasto: number): { ok: true } | { ok: false; motivo: string } {
  if (versatoRimasto > 0) return { ok: true }
  const stato = normalizzaStato(statoAttuale, versatoRimasto)
  if (stato === 'spedito' || stato === 'consegnato') {
    return {
      ok: false,
      motivo:
        'Questo è l\'unico pagamento e l\'ordine è già partito, quindi non si può togliere. Se è stato un errore, segna prima l\'ordine come "Annullato".',
    }
  }
  return { ok: true }
}

export type EsitoCambio = { ok: true } | { ok: false; motivo: string }

export const MOTIVO_ATTESA_AUTOMATICA = 'Lo stato "In attesa di acconto" è automatico: finché c\'è un acconto registrato l\'ordine non resta in attesa.'

export function puoCambiareStato(o: Ordine, nuovo: StatoOrdine): EsitoCambio {
  const versato = versatoCent(o)
  if (RICHIEDONO_ACCONTO.has(nuovo) && versato <= 0) return { ok: false, motivo: MOTIVO_ACCONTO }
  // "In attesa" non si sceglie a mano: la decide l'acconto
  if (nuovo === 'in attesa acconto' && versato > 0) return { ok: false, motivo: MOTIVO_ATTESA_AUTOMATICA }
  return { ok: true }
}

/** Gli stati che si possono scegliere a mano nel menu: "In attesa di acconto" c'è solo se l'ordine è già lì (è automatico). */
export function statiSceglibili(o: Ordine): StatoOrdine[] {
  return STATI.filter((s) => s !== 'in attesa acconto' || o.stato === 'in attesa acconto')
}

export interface Azione {
  stato: StatoOrdine
  etichetta: string
}

/** Il passo successivo del flusso, se c'è e se si può fare. */
export function prossimaAzione(o: Ordine): Azione | null {
  // "In attesa di acconto" non ha un passo manuale: si sblocca da solo quando si registra un pagamento
  const passo: Partial<Record<StatoOrdine, Azione>> = {
    confermato: { stato: 'in preparazione', etichetta: 'Inizia la preparazione' },
    'in preparazione': { stato: 'pronto', etichetta: 'Segna come pronto' },
    pronto: { stato: 'spedito', etichetta: 'Segna come spedito' },
    spedito: { stato: 'consegnato', etichetta: 'Segna come consegnato' },
  }
  const azione = passo[o.stato]
  if (!azione) return null
  return puoCambiareStato(o, azione.stato).ok ? azione : null
}

export function avvisiOrdine(o: Ordine): string[] {
  const versato = versatoCent(o)
  if (o.stato === 'in attesa acconto' && versato <= 0) return ['In attesa di acconto: finché non arriva, non si procede.']
  if (RICHIEDONO_ACCONTO.has(o.stato) && versato <= 0) return ['Ordine avanti ma con nessun pagamento registrato: controlla i pagamenti.']
  return []
}
