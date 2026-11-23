import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AvanzamentoOrdine } from '../componenti/AvanzamentoOrdine'
import { BadgePagamento } from '../componenti/BadgePagamento'
import { BadgeStato } from '../componenti/BadgeStato'
import { ascoltaClienti } from '../data/clienti'
import { ascoltaOrdini } from '../data/ordini'
import { formatData } from '../lib/calcoli'
import type { Cliente, Ordine, StatoOrdine } from '../lib/tipi'
import { testoIndirizzo } from '../lib/whatsapp'

type Vista = 'da-lavorare' | 'spediti' | 'attesa' | 'consegnati'
const VISTE: Vista[] = ['da-lavorare', 'spediti', 'attesa', 'consegnati']

const perConsegna = (a: Ordine, b: Ordine) =>
  (a.dataConsegna ?? '9999-12-31').localeCompare(b.dataConsegna ?? '9999-12-31') || a.numero - b.numero

function SchedaSpedizione({ ordine: o, cliente }: { ordine: Ordine; cliente?: Cliente }) {
  // nome e telefono dell'ordine sono copie: vale la scheda cliente, se c'è
  const vivo: Ordine = { ...o, clienteNome: cliente?.nome || o.clienteNome, clienteTelefono: cliente?.telefono || o.clienteTelefono }
  const indirizzo = cliente?.spedizione
  return (
    <article className="scheda">
      <div className="riga">
        <strong>n. {o.numero} · {vivo.clienteNome}</strong>
        <BadgeStato stato={o.stato} />
      </div>
      <div className="riga">
        <span>{o.dataConsegna ? `Consegna entro ${formatData(o.dataConsegna)}` : 'Nessuna data di consegna'}</span>
        <BadgePagamento ordine={o} />
      </div>
      <ul style={{ margin: '.5rem 0', paddingLeft: '1.1rem' }}>
        {o.righe.map((r, i) => (
          <li key={i}>{r.quantita} × {r.descrizione}{r.testoPersonalizzato ? ` (${r.testoPersonalizzato})` : ''}</li>
        ))}
      </ul>
      <p>
        {indirizzo ? (
          <>Spedire a: <strong>{testoIndirizzo(indirizzo)}</strong></>
        ) : (
          <>Indirizzo mancante. <Link to={`/clienti/${o.clienteId}`}>Aggiungilo nella scheda cliente</Link></>
        )}
      </p>
      {o.stato === 'in attesa acconto' ? (
        <>
          <p className="avviso" role="status">In attesa di acconto: finché non arriva, non si procede.</p>
          <Link to={`/ordini/${o.id}`} className="bottone">Registra l&apos;acconto</Link>
        </>
      ) : (
        <AvanzamentoOrdine key={o.id} ordine={vivo} indirizzo={indirizzo} />
      )}
      <p><Link to={`/ordini/${o.id}`}>Apri l&apos;ordine</Link></p>
    </article>
  )
}

function Gruppo({ titolo, ordini, clienti }: { titolo: string; ordini: Ordine[]; clienti: Map<string, Cliente> }) {
  if (ordini.length === 0) return null
  return (
    <section aria-label={titolo}>
      <h2>{titolo} ({ordini.length})</h2>
      {ordini.map((o) => <SchedaSpedizione key={o.id} ordine={o} cliente={clienti.get(o.clienteId)} />)}
    </section>
  )
}

export default function Spedizioni() {
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])

  useEffect(() => ascoltaOrdini(setOrdini), [])
  useEffect(() => ascoltaClienti(setClienti), [])

  return <VistaSpedizioni ordini={ordini} clienti={clienti} />
}

/** La pagina vera e propria: riceve i dati già letti (così si può provare anche con dati finti). */
export function VistaSpedizioni({ ordini, clienti }: { ordini: Ordine[]; clienti: Cliente[] }) {
  const [params, setParams] = useSearchParams()

  const richiesta = params.get('vista') ?? ''
  const vista: Vista = (VISTE as string[]).includes(richiesta) ? (richiesta as Vista) : 'da-lavorare'
  const perId = new Map(clienti.map((c) => [c.id, c]))

  const di = (s: StatoOrdine) => ordini.filter((o) => o.stato === s)
  const pronti = di('pronto').sort(perConsegna)
  const inPreparazione = di('in preparazione').sort(perConsegna)
  const daPreparare = di('confermato').sort(perConsegna)
  const spediti = di('spedito').sort((a, b) => (b.dataSpedizione ?? '').localeCompare(a.dataSpedizione ?? '') || b.numero - a.numero)
  const attesa = di('in attesa acconto').sort((a, b) => a.numero - b.numero)
  const consegnati = di('consegnato').slice(0, 20)
  const daLavorare = pronti.length + inPreparazione.length + daPreparare.length

  const conteggi: Record<Vista, number> = {
    'da-lavorare': daLavorare,
    spediti: spediti.length,
    attesa: attesa.length,
    consegnati: consegnati.length,
  }
  const nomi: Record<Vista, string> = {
    'da-lavorare': 'Da lavorare',
    spediti: 'Spediti',
    attesa: 'In attesa di acconto',
    consegnati: 'Consegnati',
  }

  return (
    <main className="pagina">
      <div className="riga no-stampa">
        <h1>Spedizioni</h1>
        <button type="button" className="secondario" onClick={() => window.print()}>Stampa</button>
      </div>
      <p className="no-stampa">
        Ogni ordine segue questi passi: acconto → conferma → preparazione → pronto → spedito (con avviso WhatsApp al cliente) → consegnato.
      </p>

      <div className="linguette no-stampa" role="group" aria-label="Cosa vuoi vedere">
        {VISTE.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vista === v}
            onClick={() => setParams(v === 'da-lavorare' ? {} : { vista: v }, { replace: true })}
          >
            {nomi[v]} ({conteggi[v]})
          </button>
        ))}
      </div>

      {vista === 'da-lavorare' && (
        <>
          {daLavorare === 0 && <p>Niente da lavorare. Quando arriva un acconto, l&apos;ordine compare qui.</p>}
          <Gruppo titolo="Pronti da spedire" ordini={pronti} clienti={perId} />
          <Gruppo titolo="In preparazione" ordini={inPreparazione} clienti={perId} />
          <Gruppo titolo="Da preparare (acconto ricevuto)" ordini={daPreparare} clienti={perId} />
        </>
      )}
      {vista === 'spediti' && (
        <>
          {spediti.length === 0 && <p>Nessun ordine spedito in attesa di consegna.</p>}
          <Gruppo titolo="Spediti, in attesa di consegna" ordini={spediti} clienti={perId} />
        </>
      )}
      {vista === 'attesa' && (
        <>
          {attesa.length === 0 && <p>Nessun ordine in attesa di acconto.</p>}
          <Gruppo titolo="In attesa di acconto" ordini={attesa} clienti={perId} />
        </>
      )}
      {vista === 'consegnati' && (
        <>
          {consegnati.length === 0 && <p>Nessun ordine consegnato.</p>}
          <Gruppo titolo="Ultimi consegnati" ordini={consegnati} clienti={perId} />
        </>
      )}
    </main>
  )
}
