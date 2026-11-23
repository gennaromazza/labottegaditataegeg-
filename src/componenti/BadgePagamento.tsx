import { daRimborsare, statoPagamento } from '../lib/calcoli'
import type { Ordine } from '../lib/tipi'

export function BadgePagamento({ ordine }: { ordine: Ordine }) {
  if (daRimborsare(ordine)) return <span className="badge avviso">Da rimborsare</span>
  const s = statoPagamento(ordine)
  const testo = { non_pagato: 'Non pagato', acconto: 'Acconto versato', saldato: 'Saldato', eccedente: 'Pagato in eccesso' }[s]
  return <span className={`badge ${s === 'saldato' ? 'ok' : s === 'eccedente' ? 'avviso' : ''}`}>{testo}</span>
}
