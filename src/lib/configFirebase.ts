const OBBLIGATORIE = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

/** Usata da vite.config.ts: senza queste variabili la build riesce ma il sito resta bianco. */
export function controllaConfigFirebase(env: Record<string, string | undefined>): void {
  const mancanti = OBBLIGATORIE.filter((nome) => !env[nome]?.trim())
  if (mancanti.length > 0) {
    throw new Error(
      `Configurazione Firebase incompleta: mancano ${mancanti.join(', ')}.\n` +
        'Copia il file .env.local nella cartella da cui compili (vedi README) e riprova.',
    )
  }
}
