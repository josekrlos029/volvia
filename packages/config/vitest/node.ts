import { defineConfig } from 'vitest/config'

/** Shared Vitest defaults for Node-side packages (api, db, shared, wallet). */
export const nodePreset = defineConfig({
  test: {
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
})

export default nodePreset
