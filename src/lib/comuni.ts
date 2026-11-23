/** [nome, sigla provincia, CAP]. Dati ISTAT/CAP del database non ufficiale comuni-json: la completezza dei CAP non è garantita. */
export type Comune = [nome: string, sigla: string, cap: string[]]

export function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cercaPerCap(comuni: Comune[], cap: string): Comune[] {
  return comuni.filter((c) => c[2].includes(cap))
}

/** Comuni il cui nome inizia con il testo, poi quelli che lo contengono. Servono almeno 2 caratteri. */
export function cercaPerNome(comuni: Comune[], testo: string, max = 8): Comune[] {
  const q = normalizza(testo)
  if (q.length < 2) return []
  const iniziano: Comune[] = []
  const contengono: Comune[] = []
  for (const c of comuni) {
    const n = normalizza(c[0])
    if (n.startsWith(q)) iniziano.push(c)
    else if (n.includes(q)) contengono.push(c)
    if (iniziano.length >= max) break
  }
  return [...iniziano, ...contengono].slice(0, max)
}

let cache: Promise<Comune[]> | null = null

/** Carica l'elenco solo quando serve, così non pesa sull'apertura dell'app. */
export function caricaComuni(): Promise<Comune[]> {
  cache ??= import('../data/comuni.json').then((m) => m.default as Comune[])
  return cache
}
