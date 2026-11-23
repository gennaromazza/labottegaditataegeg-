import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AvanzamentoOrdine } from '../componenti/AvanzamentoOrdine'
import { BadgePagamento } from '../componenti/BadgePagamento'
import { BadgeStato } from '../componenti/BadgeStato'
import { AvvisoMateriali, useCambioStato } from '../componenti/CambioStato'
import { MostraAltri, usePaginazione } from '../componenti/Paginazione'
import { Sezione } from '../componenti/Sezione'
import { ascoltaClienti } from '../data/clienti'
import { ascoltaOrdini } from '../data/ordini'
import { formatData } from '../lib/calcoli'
import { prossimaAzione } from '../lib/stati'
import type { Cliente, Ordine, StatoOrdine } from '../lib/tipi'
import { testoIndirizzo } from '../lib/whatsapp'

type Vista = 'da-lavorare' | 'spediti' | 'attesa' | 'consegnati'
const VISTE: Vista[] = ['da-lavorare', 'spediti', 'attesa', 'consegnati']

/** Fino a quanti ordini nella vista le schede si mostrano già aperte; con più ordini restano compatte. */
const SOGLIA_APERTE = 3

const perConsegna = (a: Ordine, b: Ordine) =>
  (a.dataConsegna ?? '9999-12-31').localeCompare(b.dataConsegna ?? '9999-12-31') || a.numero - b.numero

/** Il passo successivo con un tocco, per le schede chiuse (solo dove non serve scrivere altro). */
function AzioneRapida({ ordine }: { ordine: Ordine }) {
  const { cambia, procediComunque, ferma, avviso, errore, occupato } = useCambioStato(ordine)
  const azione = prossimaAzione(ordine)
  if (!azione || (ordine.stato !== 'confermato' && ordine.stato !== 'in preparazione')) return null
  return (
    <>
      <button type="button" disabled={occupato} onClick={() => void cambia(azione.stato)}>{azione.etichetta}</button>
      {errore && <span className="errore" role="alert">{errore}</span>}
      <AvvisoMateriali avviso={avviso} onProcedi={() => void procediComunque()} onFerma={ferma} occupato={occupato} />
    </>
  )
}

function SchedaSpedizione({ ordine: o, cliente, apertaDiDefault }: { ordine: Ordine; cliente?: Cliente; apertaDiDefault: boolean }) {
  const [aperta, setAperta] = useState(apertaDiDefault)
  // nome e telefono dell'ordine sono copie: vale la scheda cliente, se c'è
  const vivo: Ordine = { ...o, clienteNome: cliente?.nome || o.clienteNome, clienteTelefono: cliente?.telefono || o.clienteTelefono }
  const indirizzo = cliente?.spedizione
  const pannello = `scheda-sped-${o.id}`
  return (
    <article className="scheda" aria-label={`Ordine ${o.numero}`}>
      <div className="riga">
        <strong>n. {o.numero} · {vivo.clienteNome}</strong>
        <BadgeStato stato={o.stato} />
      </div>
      <div className="riga">
        <span>{o.dataConsegna ? `Consegna entro ${formatData(o.dataConsegna)}` : 'Nessuna data di consegna'}</span>
        <BadgePagamento ordine={o} />
      </div>
      <p>
        {indirizzo ? (
          <>Spedire a: <strong>{testoIndirizzo(indirizzo)}</strong></>
        ) : (
          <>Indirizzo mancante. <Link to={`/clienti/${o.clienteId}?apri=spedizione`}>Aggiungilo nella scheda cliente</Link></>
        )}
      </p>
      <div className="azioni">
        <button type="button" className="secondario" aria-expanded={aperta} aria-controls={pannello} onClick={() => setAperta(!aperta)}>
          {aperta ? 'Chiudi' : 'Apri'} <span className="solo-lettura">ordine {o.numero}</span>
        </button>
        {!aperta && <AzioneRapida ordine={o} />}
      </div>
      {aperta && (
        <div id={pannello}>
          <ul style={{ margin: '.5rem 0', paddingLeft: '1.1rem' }}>
            {o.righe.map((r, i) => (
              <li key={i}>{r.quantita} × {r.descrizione}{r.testoPersonalizzato ? ` (${r.testoPersonalizzato})` : ''}</li>
            ))}
          </ul>
          {o.stato === 'in attesa acconto' ? (
            <>
              <p className="avviso" role="status">In attesa di acconto: finché non arriva, non si procede.</p>
              <Link to={`/ordini/${o.id}`} className="bottone">Registra l&apos;acconto</Link>
            </>
          ) : (
            <AvanzamentoOrdine key={o.id} ordine={vivo} indirizzo={indirizzo} />
          )}
          <p><Link to={`/ordini/${o.id}`}>Apri la pagina dell&apos;ordine</Link></p>
        </div>
      )}
    </article>
  )
}

function Gruppo({
  titolo,
  ordini,
  clienti,
  aperto,
  schedeAperte,
}: {
  titolo: string
  ordini: Ordine[]
  clienti: Map<string, Cliente>
  aperto: boolean
  schedeAperte: boolean
}) {
  const { visibili, resto, mostraAltri } = usePaginazione(ordini, 10, titolo)
  if (ordini.length === 0) return null
  return (
    <Sezione titolo={titolo} conteggio={ordini.length} aperta={aperto} ricorda={`spedizioni:${titolo}`}>
      {visibili.map((o) => <SchedaSpedizione key={o.id} ordine={o} cliente={clienti.get(o.clienteId)} apertaDiDefault={schedeAperte} />)}
      <MostraAltri resto={resto} passo={10} onClick={mostraAltri} />
    </Sezione>
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

  // con pochi ordini tutto è aperto; con tanti restano aperti solo il primo gruppo e le schede chiuse, per non scorrere all'infinito
  const gruppi: { titolo: string; ordini: Ordine[] }[] =
    vista === 'da-lavorare'
      ? [
          { titolo: 'Pronti da spedire', ordini: pronti },
          { titolo: 'In preparazione', ordini: inPreparazione },
          { titolo: 'Da preparare (acconto ricevuto)', ordini: daPreparare },
        ]
      : vista === 'spediti'
        ? [{ titolo: 'Spediti, in attesa di consegna', ordini: spediti }]
        : vista === 'attesa'
          ? [{ titolo: 'In attesa di acconto', ordini: attesa }]
          : [{ titolo: 'Ultimi consegnati', ordini: consegnati }]
  const totaleVista = gruppi.reduce((s, g) => s + g.ordini.length, 0)
  const pochi = totaleVista <= SOGLIA_APERTE
  const primoNonVuoto = gruppi.find((g) => g.ordini.length > 0)?.titolo

  const vuoto: Record<Vista, string> = {
    'da-lavorare': 'Niente da lavorare. Quando arriva un acconto, l\'ordine compare qui.',
    spediti: 'Nessun ordine spedito in attesa di consegna.',
    attesa: 'Nessun ordine in attesa di acconto.',
    consegnati: 'Nessun ordine consegnato.',
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

      {totaleVista === 0 && <p>{vuoto[vista]}</p>}
      {gruppi.map((g) => (
        <Gruppo
          key={g.titolo}
          titolo={g.titolo}
          ordini={g.ordini}
          clienti={perId}
          aperto={pochi || g.titolo === primoNonVuoto}
          schedeAperte={pochi}
        />
      ))}
      {totaleVista > 0 && (
        <p className="no-stampa"><Link to="/ordini">Vedi tutti gli ordini</Link></p>
      )}
    </main>
  )
}
