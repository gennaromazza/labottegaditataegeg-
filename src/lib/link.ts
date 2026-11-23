/** Indirizzo stabile di un ordine: apre la scheda dell'ordine (serve il login). In futuro si potrà codificare in un QR code. */
export function linkOrdine(id: string, origine: string = window.location.origin): string {
  return `${origine.replace(/\/+$/, '')}/ordini/${encodeURIComponent(id)}`
}
