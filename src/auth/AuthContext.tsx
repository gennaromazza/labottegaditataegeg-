import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'

interface Valore {
  utente: User | null
  caricamento: boolean
  accedi(email: string, password: string): Promise<void>
  esci(): Promise<void>
}

const Contesto = createContext<Valore | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<User | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUtente(u)
        setCaricamento(false)
      }),
    [],
  )

  const valore: Valore = {
    utente,
    caricamento,
    accedi: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    },
    esci: () => signOut(auth),
  }
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

export function useAuth(): Valore {
  const v = useContext(Contesto)
  if (!v) throw new Error('useAuth fuori da AuthProvider')
  return v
}
