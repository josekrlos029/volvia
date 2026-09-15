import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { main: 'src/main.ts', worker: 'src/worker.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  // Workspace packages ship TypeScript source, so they must be bundled in.
  noExternal: [/^@volvia\//],
  banner: {
    // Some CJS dependencies expect `require` to exist in the ESM bundle.
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
})
