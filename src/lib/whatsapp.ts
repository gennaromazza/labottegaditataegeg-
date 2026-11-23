import { formatData, formatEuro, residuoCent, totaleCent, versatoCent } from './calcoli'
import type { Ordine } from './tipi'

export function normalizzaTelefono(raw: string, prefisso = '39'): string | null {
  const pulito = raw.trim().replace(/[^\d+]/g, '')
  let cifre = pulito.replace(/\+/g, '')
  if (pulito.startsWith('+')) {
    // già internazionale
  } else if (cifre.startsWith('00')) {
    cifre = cifre.slice(2)
  } else {
    cifre = prefisso + cifre
  }
  const soloCifreUtente = raw.replace(/\D/g, '')
  if (soloCifreUtente.length < 6 || cifre.length < 8) return null
  return cifre
}

export function messaggioOrdine(o: Ordine): string {
  const righe = o.righe.map((r) => {
    const testo = r.testoPersonalizzato ? ` (${r.testoPersonalizzato})` : ''
    return `• ${r.quantita} × ${r.descrizione}${testo} – ${formatEuro(r.quantita * r.prezzoUnitarioCent)}`
  })
  const parti = [
    `Ciao ${o.clienteNome}! Ecco il riepilogo del tuo ordine n. ${o.numero} – La Bottega di Tata e Gegè`,
    '',
    ...righe,
    '',
    `Totale: ${formatEuro(totaleCent(o.righe))}`,
    `Versato: ${formatEuro(versatoCent(o))}`,
    `Da saldare: ${formatEuro(residuoCent(o))}`,
  ]
  if (o.dataConsegna) parti.push(`Consegna prevista: ${formatData(o.dataConsegna)}`)
  parti.push('', 'Grazie! 🧡')
  return parti.join('\n')
}

export function linkWhatsApp(o: Ordine): string | null {
  const numero = o.clienteTelefono ? normalizzaTelefono(o.clienteTelefono) : null
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(messaggioOrdine(o))}`
}
