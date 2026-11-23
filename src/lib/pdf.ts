import { jsPDF } from 'jspdf'
import { formatData, formatEuro, residuoCent, totaleCent, versatoCent } from './calcoli'
import type { Ordine } from './tipi'

/** I font PDF standard conoscono solo Latin-1 e €: emoji e altri simboli si tolgono invece di rompere il file. */
export function sicuroPerPdf(testo: string): string {
  return Array.from(testo)
    .filter((c) => {
      const cp = c.codePointAt(0)!
      return cp === 0x20ac || cp === 0x0a || (cp >= 0x20 && cp <= 0xff && cp !== 0x7f && !(cp >= 0x80 && cp < 0xa0))
    })
    .join('')
}

export async function generaPdfOrdine(o: Ordine, logoDataUrl?: string): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const larghezza = 210
  const margine = 18
  let y = 20

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margine, y - 6, 30, 30)
    } catch {
      // logo non leggibile: il PDF resta valido senza
    }
  }
  doc.setFont('helvetica', 'bold').setFontSize(18)
  doc.text('La Bottega di Tata e Gege', margine + 36, y + 6)
  doc.setFont('helvetica', 'normal').setFontSize(11)
  doc.text(sicuroPerPdf(`Riepilogo ordine n. ${o.numero}`), margine + 36, y + 14)
  y += 34

  doc.setFontSize(11)
  doc.text(sicuroPerPdf(`Cliente: ${o.clienteNome}`), margine, y)
  y += 6
  if (o.dataConsegna) {
    doc.text(`Consegna prevista: ${formatData(o.dataConsegna)}`, margine, y)
    y += 6
  }
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.text('Prodotto', margine, y)
  doc.text('Q.ta', 120, y, { align: 'right' })
  doc.text('Prezzo', 150, y, { align: 'right' })
  doc.text('Importo', larghezza - margine, y, { align: 'right' })
  y += 2
  doc.line(margine, y, larghezza - margine, y)
  y += 6
  doc.setFont('helvetica', 'normal')

  for (const r of o.righe) {
    const titolo = sicuroPerPdf(r.testoPersonalizzato ? `${r.descrizione} (${r.testoPersonalizzato})` : r.descrizione)
    const righeTesto = doc.splitTextToSize(titolo, 90) as string[]
    if (y + righeTesto.length * 5 > 270) {
      doc.addPage()
      y = 20
    }
    doc.text(righeTesto, margine, y)
    doc.text(String(r.quantita), 120, y, { align: 'right' })
    doc.text(formatEuro(r.prezzoUnitarioCent), 150, y, { align: 'right' })
    doc.text(formatEuro(r.quantita * r.prezzoUnitarioCent), larghezza - margine, y, { align: 'right' })
    y += righeTesto.length * 5 + 2
  }

  y += 2
  doc.line(margine, y, larghezza - margine, y)
  y += 7
  const riepilogo: [string, string][] = [
    ['Totale', formatEuro(totaleCent(o.righe))],
    ['Versato', formatEuro(versatoCent(o))],
    ['Da saldare', formatEuro(residuoCent(o))],
  ]
  doc.setFont('helvetica', 'bold')
  for (const [etichetta, valore] of riepilogo) {
    doc.text(etichetta, 150, y, { align: 'right' })
    doc.text(valore, larghezza - margine, y, { align: 'right' })
    y += 7
  }

  return doc.output('blob')
}
