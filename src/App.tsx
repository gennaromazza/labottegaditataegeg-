import { Route, Routes, Navigate } from 'react-router-dom'

function Segnaposto({ titolo }: { titolo: string }) {
  return (
    <main className="pagina">
      <img src="/logo.png" alt="" height={64} />
      <h1>La Bottega di Tata e Gegè</h1>
      <p>{titolo}</p>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Segnaposto titolo="Accesso" />} />
      <Route path="/ordini" element={<Segnaposto titolo="Ordini" />} />
      <Route path="/ordini/nuovo" element={<Segnaposto titolo="Nuovo ordine" />} />
      <Route path="/ordini/:id" element={<Segnaposto titolo="Dettaglio ordine" />} />
      <Route path="/clienti" element={<Segnaposto titolo="Clienti" />} />
      <Route path="/clienti/:id" element={<Segnaposto titolo="Scheda cliente" />} />
      <Route path="/incassi" element={<Segnaposto titolo="Incassi" />} />
      <Route path="/listino" element={<Segnaposto titolo="Listino" />} />
      <Route path="*" element={<Navigate to="/ordini" replace />} />
    </Routes>
  )
}
