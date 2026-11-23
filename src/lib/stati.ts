import { versatoCent } from './calcoli'
import { STATI, type Ordine, type StatoOrdine } from './tipi'

/** Stati che richiedono almeno un acconto: senza, l'ordine non procede. */
const RICHIEDONO_ACCONTO = new Set<StatoOrdine>(['confermato', 'in preparazione', 'pronto', 'spedito', 'consegnato'])

export const MOTIVO_ACCONTO = 'Senza un acconto non si procede: registra prima un pagamento.'

/** Un ordine nasce confermato se ha già un acconto, altrimenti aspetta. */
export function statoIniziale(versato: number): StatoOrdine {
  return versato > 0 ? 'confermato' : 'in attesa acconto'
}

/** Gli ordini creati con i vecchi stati ("da fare", "in lavorazione") si leggono con quelli nuovi. */
export function normalizzaStato(raw: string, versato: number): StatoOrdine {
  if ((STATI as string[]).includes(raw)) return raw as StatoOrdine
  if (raw === 'in lavorazione') return 'in preparazione'
  return statoIniziale(versato)
}

/** Dopo un nuovo pagamento: un ordine che aspettava l'acconto diventa confermato. null = lo stato resta com'è. */
export function statoDopoNuovoPagamento(statoAttuale: string, versatoOra: number): StatoOrdine | null {
  if (versatoOra <= 0) return null
  return statoAttuale === 'in attesa acconto' || statoAttuale === 'da fare' ? 'confermato' : null
}

/** Dopo aver tolto un pagamento: se era l'unico e l'ordine era solo confermato, torna in attesa. */
export function statoDopoRimozionePagamento(statoAttuale: string, versatoRimasto: number): StatoOrdine | null {
  return versatoRimasto <= 0 && statoAttuale === 'confermato' ? 'in attesa acconto' : null
}

/** Errore di una regola di lavoro (non un guasto): il messaggio si può mostrare così com'è. */
export class ErroreRegola extends Error {}

/** Togliere l'unico acconto da un ordine già avanti lo lascerebbe senza pagamenti: prima si cambia lo stato. */
export function rimozionePermessa(statoAttuale: string, versatoRimasto: number): { ok: true } | { ok: false; motivo: string } {
  if (versatoRimasto > 0) return { ok: true }
  const stato = normalizzaStato(statoAttuale, versatoRimasto)
  if (RICHIEDONO_ACCONTO.has(stato) && stato !== 'confermato') {
    return {
      ok: false,
      motivo:
        'Questo è l\'unico pagamento e l\'ordine è già avanti. Prima cambia lo stato (per esempio "In attesa di acconto" o "Annullato"), poi rimuovi il pagamento.',
    }
  }
  return { ok: true }
}

export type EsitoCambio = { ok: true } | { ok: false; motivo: string }

export function puoCambiareStato(o: Ordine, nuovo: StatoOrdine): EsitoCambio {
  if (RICHIEDONO_ACCONTO.has(nuovo) && versatoCent(o) <= 0) return { ok: false, motivo: MOTIVO_ACCONTO }
  return { ok: true }
}

export interface Azione {
  stato: StatoOrdine
  etichetta: string
}

/** Il passo successivo del flusso, se c'è e se si può fare. */
export function prossimaAzione(o: Ordine): Azione | null {
  const passo: Partial<Record<StatoOrdine, Azione>> = {
    'in attesa acconto': { stato: 'confermato', etichetta: 'Conferma ordine' },
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
