import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(ROOT, '../../data');

/** Read the canonical pool, falling back to the committed sample. */
function loadPoolJson(): string {
  const real = resolve(DATA_DIR, 'locations.json');
  const sample = resolve(DATA_DIR, 'locations.sample.json');
  return readFileSync(existsSync(real) ? real : sample, 'utf8');
}

/**
 * Serves `data/locations.json` (or the sample) at `/locations.json` during dev
 * and bundles it as a static asset for production — so there is a single source
 * of truth for the pool and no manual copy step.
 */
function poolPlugin(): Plugin {
  const ROUTE = '/locations.json';
  return {
    name: 'geo-guess-pool',
    configureServer(server) {
      const handler: Connect.NextHandleFunction = (req, res, next) => {
        if (req.url === ROUTE) {
          res.setHeader('content-type', 'application/json');
          res.end(loadPoolJson());
          return;
        }
        next();
      };
      server.middlewares.use(handler);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'locations.json', source: loadPoolJson() });
    },
  };
}

export default defineConfig({
  plugins: [svelte(), poolPlugin()],
  // Read VITE_* from the repo-root .env (single env file for the whole monorepo).
  envDir: resolve(ROOT, '../..'),
  clearScreen: false,
  server: { port: 5173, strictPort: false },
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
