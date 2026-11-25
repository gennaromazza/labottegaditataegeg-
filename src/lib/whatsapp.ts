import { formatData, formatEuro, haSpedizione, residuoCent, spedizioneCent, totaleOrdineCent, versatoCent } from './calcoli'
import type { Ordine, Spedizione } from './tipi'

export function normalizzaTelefono(raw: string, prefisso = '39'): string | null {
  const pulito = raw.trim().replace(/[^\d+]/g, '')
  let cifre = pulito.replace(/\+/g, '')
  if (pulito.startsWith('+')) {
    // già internazionale
  } else if (cifre.startsWith('00')) {
    cifre = cifre.slice(2)
  } else if (cifre.startsWith(prefisso) && cifre.length >= 11) {
    // già con il prefisso del paese ma senza "+" (es. 393331234567): non si raddoppia
  } else {
    cifre = prefisso + cifre
  }
  const soloCifreUtente = raw.replace(/\D/g, '')
  if (soloCifreUtente.length < 6 || cifre.length < 8) return null
  return cifre
}

function rigaResiduo(o: Ordine): string {
  const residuo = residuoCent(o)
  if (o.stato === 'annullato') return 'Ordine annullato'
  if (residuo > 0) return `Da saldare: ${formatEuro(residuo)}`
  if (residuo < 0) return `Pagato in più: ${formatEuro(-residuo)}`
  return 'Saldato'
}

export function messaggioOrdine(o: Ordine): string {
  const righe = o.righe.map((r) => {
    const testo = r.testoPersonalizzato ? ` (${r.testoPersonalizzato})` : ''
    return `• ${r.quantita} × ${r.descrizione}${testo} – ${formatEuro(r.quantita * r.prezzoUnitarioCent)}`
  })
  const parti = [
    `Ciao ${o.clienteNome}! Ecco il riepilogo del tuo ordine – Tratti di Bottega`,
    '',
    ...righe,
    ...(haSpedizione(o) ? [spedizioneCent(o) > 0 ? `Spedizione: ${formatEuro(spedizioneCent(o))}` : 'Spedizione gratuita'] : []),
    '',
    `Totale${spedizioneCent(o) > 0 ? ' (spedizione compresa)' : ''}: ${formatEuro(totaleOrdineCent(o))}`,
    `Versato: ${formatEuro(versatoCent(o))}`,
    rigaResiduo(o),
  ]
  if (o.dataConsegna) parti.push(`Consegna prevista: ${formatData(o.dataConsegna)}`)
  parti.push('', 'Grazie! 🧡')
  return parti.join('\n')
}

export function testoIndirizzo(s: Spedizione): string {
  return `${s.destinatario ? `${s.destinatario}, ` : ''}${s.indirizzo}, ${s.cap} ${s.citta} (${s.provincia})`
}

/** Avviso al cliente quando l'ordine parte. */
export function messaggioSpedizione(o: Ordine, indirizzo?: Spedizione): string {
  const prodotti = o.righe.map((r) => {
    const testo = r.testoPersonalizzato ? ` (${r.testoPersonalizzato})` : ''
    return `• ${r.quantita} × ${r.descrizione}${testo}`
  })
  const parti = [
    `Ciao ${o.clienteNome}! 🎁`,
    'Una bella notizia: il tuo ordine è stato spedito! 📦',
    '',
    ...prodotti,
  ]
  const dettagli: string[] = []
  if (o.corriere) dettagli.push(`Corriere: ${o.corriere}`)
  if (o.tracking) dettagli.push(`Codice di tracciamento: ${o.tracking}`)
  if (indirizzo) dettagli.push(`Arriverà a: ${testoIndirizzo(indirizzo)}`)
  if (dettagli.length > 0) parti.push('', ...dettagli)
  const residuo = residuoCent(o)
  if (residuo > 0) parti.push('', `Ti ricordo che restano da saldare ${formatEuro(residuo)}. Ci mettiamo d'accordo con calma! 😊`)
  parti.push('', 'Grazie di cuore per aver scelto Tratti di Bottega! 🧡', 'Facci sapere quando lo ricevi: ci fa sempre tanto piacere.')
  return parti.join('\n')
}

export function linkSpedizione(o: Ordine, indirizzo?: Spedizione): string | null {
  const numero = o.clienteTelefono ? normalizzaTelefono(o.clienteTelefono) : null
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(messaggioSpedizione(o, indirizzo))}`
}

export function linkWhatsApp(o: Ordine): string | null {
  const numero = o.clienteTelefono ? normalizzaTelefono(o.clienteTelefono) : null
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(messaggioOrdine(o))}`
}
