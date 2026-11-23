// Genera src/data/comuni.json (compatto) dal file comuni.json di https://github.com/matteocontrini/comuni-json
// (database non ufficiale: dati ISTAT e CAP, completezza dei CAP non garantita).
// Uso: node scripts/genera-comuni.cjs <percorso/comuni.json>
const fs = require('node:fs')
const path = require('node:path')

const origine = process.argv[2]
if (!origine) {
  console.error('Uso: node scripts/genera-comuni.cjs <percorso/comuni.json>')
  process.exit(1)
}
const comuni = JSON.parse(fs.readFileSync(origine, 'utf8'))
const compatto = comuni
  .filter((c) => c.nome && c.sigla && Array.isArray(c.cap) && c.cap.length > 0)
  .map((c) => [c.nome, c.sigla, c.cap])
  .sort((a, b) => a[0].localeCompare(b[0], 'it'))

const destinazione = path.join(__dirname, '..', 'src', 'data', 'comuni.json')
fs.writeFileSync(destinazione, JSON.stringify(compatto))
console.log(`Scritti ${compatto.length} comuni in ${destinazione}`)
