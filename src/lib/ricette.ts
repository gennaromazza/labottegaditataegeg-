import { ErroreRegola } from './stati'
import type { Articolo, Riga, ScaricoMagazzino, StatoOrdine, VoceScarico } from './tipi'
import { formatQuantitaComoda, type Unita } from './unita'

/** Quanto serve di un materiale per un ordine (in unità base del materiale). */
export interface Necessita {
  articoloId: string
  nome: string
  unita: Unita
  necessaria: number
}

export interface Mancante extends Necessita {
  disponibile: number
  mancante: number
}

/**
 * Per ogni riga dell'ordine nata da un Prodotto con ricetta: quantità della riga × quantità della ricetta.
 * Le righe scritte a mano, i prodotti senza ricetta e le quantità zero non scalano nulla.
 * `problemi` elenca ingredienti non trovati o disattivati (da mostrare, non bloccano).
 */
export function fabbisogno(righe: Riga[], articoli: Articolo[]): { voci: Necessita[]; problemi: string[] } {
  const perId = new Map(articoli.map((a) => [a.id, a]))
  const somma = new Map<string, Necessita>()
  const problemi = new Set<string>()

  for (const riga of righe) {
    if (!riga.articoloId || !(riga.quantita > 0)) continue
    const prodotto = perId.get(riga.articoloId)
    if (!prodotto?.ricetta?.length) continue
    for (const ing of prodotto.ricetta) {
      const materiale = perId.get(ing.articoloId)
      if (!materiale) {
        problemi.add(`Ingrediente di "${prodotto.nome}" non trovato in magazzino: non viene scalato.`)
        continue
      }
      if (materiale.tipo !== 'materiale') {
        problemi.add(`"${materiale.nome}" non è un materiale: non viene scalato.`)
        continue
      }
      if (!materiale.attivo) problemi.add(`"${materiale.nome}" è disattivato in magazzino.`)
      const prima = somma.get(materiale.id)
      somma.set(materiale.id, {
        articoloId: materiale.id,
        nome: materiale.nome,
        unita: materiale.unita,
        necessaria: (prima?.necessaria ?? 0) + riga.quantita * ing.quantita,
      })
    }
  }
  return { voci: [...somma.values()], problemi: [...problemi] }
}

const giacenzaDi = (articoli: Articolo[], id: string) => articoli.find((a) => a.id === id)?.giacenza ?? 0

/** Confronta il fabbisogno con la giacenza: chi non basta finisce in `mancanti`. */
export function verificaDisponibilita(voci: Necessita[], articoli: Articolo[]): { ok: boolean; mancanti: Mancante[] } {
  const mancanti: Mancante[] = []
  for (const v of voci) {
    const disponibile = giacenzaDi(articoli, v.articoloId)
    if (v.necessaria > disponibile) mancanti.push({ ...v, disponibile, mancante: v.necessaria - disponibile })
  }
  return { ok: mancanti.length === 0, mancanti }
}

/** Cosa si scala davvero: quanto serve, ma mai più di quello che c'è (la giacenza non va sotto zero). */
export function pianoScarico(voci: Necessita[], articoli: Articolo[]): VoceScarico[] {
  return voci.map((v) => ({ ...v, scalata: Math.min(v.necessaria, giacenzaDi(articoli, v.articoloId)) }))
}

/** "Filamento PLA: servono 540 g, ne hai 300 g". */
export function testoMancante(m: Mancante): string {
  return `${m.nome}: servono ${formatQuantitaComoda(m.necessaria, m.unita)}, ne hai ${formatQuantitaComoda(m.disponibile, m.unita)}`
}

export { formatQuantitaComoda }

export const vociDaRipristinare = (scarico: ScaricoMagazzino | undefined): VoceScarico[] =>
  (scarico?.voci ?? []).filter((v) => v.scalata > 0)

/**
 * Se l'ordine torna indietro (o salta) prima della spedizione, i materiali scalati tornano in magazzino.
 * Se era già spedito o consegnato la merce è partita: non si ripristina.
 */
export function deveRipristinare(nuovoStato: StatoOrdine, scarico: ScaricoMagazzino | undefined, statoPrima?: StatoOrdine): boolean {
  if (scarico === undefined) return false
  if (statoPrima === 'spedito' || statoPrima === 'consegnato') return false
  return ['annullato', 'in attesa acconto', 'confermato'].includes(nuovoStato)
}

/** Quanti pezzi si possono fare col magazzino di oggi: decide il materiale più scarso. null = nessuna ricetta. */
export function pezziRealizzabili(prodotto: Articolo, articoli: Articolo[]): number | null {
  if (!prodotto.ricetta?.length) return null
  let minimo = Infinity
  for (const ing of prodotto.ricetta) {
    const materiale = articoli.find((a) => a.id === ing.articoloId)
    if (!materiale || !(ing.quantita > 0)) return 0
    minimo = Math.min(minimo, Math.floor(materiale.giacenza / ing.quantita))
  }
  return minimo === Infinity ? 0 : minimo
}

/** Errore "regola di lavoro": mancano materiali. L'interfaccia lo mostra e fa scegliere se procedere. */
export class ErroreMateriali extends ErroreRegola {
  mancanti: Mancante[]
  constructor(mancanti: Mancante[]) {
    super(`Mancano materiali: ${mancanti.map(testoMancante).join('; ')}`)
    this.mancanti = mancanti
  }
}
