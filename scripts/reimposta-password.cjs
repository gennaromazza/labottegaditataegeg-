// Imposta la password di un utente Firebase Auth, chiedendola nel terminale (digitazione nascosta).
// Uso:  node scripts/reimposta-password.cjs <email>
// Richiede la Firebase CLI già autenticata (firebase login). La password non viene salvata né stampata.
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const readline = require('node:readline')
const bcrypt = require('bcryptjs')

const PROGETTO = 'labottega-tata-gege'
const email = (process.argv[2] || '').trim().toLowerCase()
if (!email) {
  console.error('Uso: node scripts/reimposta-password.cjs <email>')
  process.exit(1)
}

function chiediNascosta(domanda) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => {
      if (s.includes(domanda)) process.stdout.write(s)
      else if (s === '\r\n' || s === '\n') process.stdout.write(s)
    }
    rl.question(domanda, (r) => {
      rl.close()
      ok(r)
    })
  })
}

function firebase(args) {
  // stdin chiuso e modalità non interattiva: la CLI non deve mai restare in attesa di una risposta
  const comando = ['firebase', ...args, '--project', PROGETTO, '--non-interactive'].join(' ')
  const r = spawnSync(comando, { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 })
  if (r.status !== 0) {
    console.error((r.stdout || '') + (r.stderr || '') + (r.error ? String(r.error) : ''))
    process.exit(1)
  }
}

;(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bottega-pwd-'))
  try {
    const esportato = path.join(tmp, 'utenti.json')
    console.log('Leggo gli utenti da Firebase (può volerci qualche secondo)...')
    firebase(['auth:export', `"${esportato}"`, '--format=JSON'])
    const utente = JSON.parse(fs.readFileSync(esportato, 'utf8')).users.find((u) => (u.email || '').toLowerCase() === email)
    if (!utente) {
      console.error(`Nessun utente con email ${email}`)
      process.exit(1)
    }

    const p1 = await chiediNascosta(`Nuova password per ${email} (min. 8 caratteri): `)
    const p2 = await chiediNascosta('Ripeti la password: ')
    if (p1 !== p2) throw new Error('Le due password non coincidono')
    if (p1.length < 8) throw new Error('La password deve avere almeno 8 caratteri')

    const file = path.join(tmp, 'import.json')
    fs.writeFileSync(
      file,
      JSON.stringify({
        users: [
          {
            localId: utente.localId,
            email: utente.email,
            emailVerified: !!utente.emailVerified,
            passwordHash: Buffer.from(bcrypt.hashSync(p1, 10)).toString('base64'),
          },
        ],
      }),
    )
    console.log('Aggiorno la password...')
    firebase(['auth:import',`"${file}"`, '--hash-algo=BCRYPT'])
    console.log('Password aggiornata. Ora puoi accedere all\'app.')
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})()
