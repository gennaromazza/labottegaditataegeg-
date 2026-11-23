import { ETICHETTE_STATO, type StatoOrdine } from '../lib/tipi'

const CLASSE: Record<StatoOrdine, string> = {
  'in attesa acconto': 'avviso',
  confermato: '',
  'in preparazione': '',
  pronto: 'info',
  spedito: 'info',
  consegnato: 'ok',
  annullato: 'spento',
}

export function BadgeStato({ stato }: { stato: StatoOrdine }) {
  return <span className={`badge ${CLASSE[stato]}`.trim()}>{ETICHETTE_STATO[stato]}</span>
}
