import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RottaProtetta } from './auth/RottaProtetta'
import { Guscio } from './componenti/Guscio'
import Login from './pagine/Login'
import Ordini from './pagine/Ordini'
import OrdineForm from './pagine/OrdineForm'
import OrdineDettaglio from './pagine/OrdineDettaglio'
import Clienti from './pagine/Clienti'
import ClienteScheda from './pagine/ClienteScheda'
import Incassi from './pagine/Incassi'
import Spese from './pagine/Spese'
import Account from './pagine/Account'
import Listino from './pagine/Listino'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RottaProtetta />}>
          <Route element={<Guscio />}>
            <Route path="/ordini" element={<Ordini />} />
            <Route path="/ordini/nuovo" element={<OrdineForm />} />
            <Route path="/ordini/:id" element={<OrdineDettaglio />} />
            <Route path="/clienti" element={<Clienti />} />
            <Route path="/clienti/:id" element={<ClienteScheda />} />
            <Route path="/incassi" element={<Incassi />} />
            <Route path="/spese" element={<Spese />} />
            <Route path="/account" element={<Account />} />
            <Route path="/listino" element={<Listino />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/ordini" replace />} />
      </Routes>
    </AuthProvider>
  )
}
