/** "3,50" | "3.5" | "1.250,00" → centesimi; null se non valido o negativo. */
export function parseEuro(testo: string): number | null {
  let t = testo.trim().replace(/\s|€/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100)
}

export function centInEuroTesto(cent: number): string {
  return (cent / 100).toFixed(2).replace('.', ',')
}
