import { controllaConfigFirebase } from './configFirebase.ts'

const completa = {
  VITE_FIREBASE_API_KEY: 'chiave-finta',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-bottega',
  VITE_FIREBASE_APP_ID: '1:000:web:000',
}

test('con la configurazione completa non blocca', () => {
  expect(() => controllaConfigFirebase(completa)).not.toThrow()
})

test('senza configurazione ferma tutto ed elenca le variabili mancanti', () => {
  expect(() => controllaConfigFirebase({})).toThrow(
    /VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID.*\.env\.local/s,
  )
})

test('un valore vuoto o di soli spazi conta come mancante', () => {
  expect(() =>
    controllaConfigFirebase({ ...completa, VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_APP_ID: '  ' }),
  ).toThrow(/mancano VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID\./)
})
