import '@testing-library/jest-dom/vitest'

// la memoria della sessione non deve passare da un test all'altro
afterEach(() => {
  try {
    sessionStorage.clear()
  } catch {
    // niente da pulire
  }
})
