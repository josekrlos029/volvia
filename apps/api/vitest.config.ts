import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Integration tests share one Postgres/Redis, so they must not race each other.
    fileParallelism: false,
  },
})
