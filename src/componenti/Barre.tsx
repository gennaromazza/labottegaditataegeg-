import { formatEuro } from '../lib/calcoli'

export function Barre({ voci, vuoto = 'Nessun dato nel periodo.' }: { voci: { chiave: string; totaleCent: number }[]; vuoto?: string }) {
  const max = Math.max(1, ...voci.map((v) => v.totaleCent))
  if (voci.length === 0) return <p>{vuoto}</p>
  return (
    <div>
      {voci
        .slice()
        .sort((a, b) => b.totaleCent - a.totaleCent)
        .map((v) => (
          <div key={v.chiave} style={{ marginBottom: '.6rem' }}>
            <div className="riga"><span>{v.chiave}</span><strong>{formatEuro(v.totaleCent)}</strong></div>
            <div className="barra" style={{ width: `${Math.max(2, (v.totaleCent / max) * 100)}%` }} />
          </div>
        ))}
    </div>
  )
}
