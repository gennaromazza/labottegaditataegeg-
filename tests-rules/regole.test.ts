import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bottega',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(async () => env.cleanup())

const AUTORIZZATA = 'clickfotoegadget@hotmail.com'
const ADMIN = 'gennaro.mazzacane@gmail.com'

describe('regole firestore', () => {
  it('nega a utente non loggato', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'ordini/x')))
    await assertFails(setDoc(doc(db, 'ordini/x'), { a: 1 }))
  })
  it('nega a utente loggato ma non in lista', async () => {
    const db = env.authenticatedContext('u1', { email: 'altro@example.com' }).firestore()
    await assertFails(getDoc(doc(db, 'ordini/x')))
    await assertFails(setDoc(doc(db, 'clienti/x'), { a: 1 }))
  })
  it.each([AUTORIZZATA, ADMIN])('consente a %s sulle collezioni previste', async (email) => {
    const db = env.authenticatedContext('u2', { email }).firestore()
    for (const col of ['clienti', 'ordini', 'listino', 'spese', 'movimenti', 'meta']) {
      await assertSucceeds(setDoc(doc(db, `${col}/x`), { a: 1 }))
      await assertSucceeds(getDoc(doc(db, `${col}/x`)))
    }
  })
  it('nega qualunque altra collezione anche agli autorizzati', async () => {
    const db = env.authenticatedContext('u2', { email: ADMIN }).firestore()
    await assertFails(setDoc(doc(db, 'segreti/x'), { a: 1 }))
  })
})
