import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ascoltaArticoli } from '../data/magazzino'
import type { Articolo } from '../lib/tipi'

/** Gli articoli del magazzino, letti una volta sola e condivisi (servono per controllare i materiali di un ordine). */
const Contesto = createContext<Articolo[]>([])

export function ArticoliProvider({ children }: { children: ReactNode }) {
  const [articoli, setArticoli] = useState<Articolo[]>([])
  useEffect(() => ascoltaArticoli(setArticoli), [])
  return <Contesto.Provider value={articoli}>{children}</Contesto.Provider>
}

export const useArticoli = (): Articolo[] => useContext(Contesto)
