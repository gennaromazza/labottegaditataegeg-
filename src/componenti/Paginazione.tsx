import { useEffect, useState } from 'react'

/**
 * Mostra solo i primi elementi di una lista lunga, con "Mostra altri".
 * Ricomincia dall'inizio quando cambia `chiave` (per esempio quando cambia un filtro).
 */
export function usePaginazione<T>(lista: T[], passo = 15, chiave = '') {
  const [quanti, setQuanti] = useState(passo)
  useEffect(() => setQuanti(passo), [chiave, passo])
  return {
    visibili: lista.slice(0, quanti),
    resto: Math.max(0, lista.length - quanti),
    mostraAltri: () => setQuanti((q) => q + passo),
  }
}

export function MostraAltri({ resto, passo = 15, onClick }: { resto: number; passo?: number; onClick: () => void }) {
  if (resto <= 0) return null
  return (
    <p className="no-stampa">
      <button type="button" className="secondario" onClick={onClick}>Mostra altri {Math.min(passo, resto)} (ne restano {resto})</button>
    </p>
  )
}
