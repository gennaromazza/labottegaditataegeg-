export function oggiISO(): string {
  const d = new Date()
  const mese = String(d.getMonth() + 1).padStart(2, '0')
  const giorno = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mese}-${giorno}`
}

/** Firestore rifiuta i campi `undefined`: li toglie prima di scrivere. */
export function senzaUndefined<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T
}
