import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Dev and preview both proxy the sidecar API (brief 10.2). Pry has no proxy,
// so this part is Flinch's own (plan F13). preview.proxy is set explicitly
// rather than relying on preview inheriting server.proxy (plan R8, A1).
const SIDECAR = process.env.FLINCH_SIDECAR ?? 'http://127.0.0.1:8000';

const proxy = {
  '/api': { target: SIDECAR },
  '/health': { target: SIDECAR },
  '/docs': { target: SIDECAR },
  '/openapi.json': { target: SIDECAR },
};

// Preview port: FLINCH_E2E_PREVIEW_PORT, else ui/.e2e-ports.json (written by
// scripts/new-worktree.ps1), else 4173 (plan F9, K3).
function previewPort(): number {
  const fromEnv = Number(process.env.FLINCH_E2E_PREVIEW_PORT);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  try {
    const file = fileURLToPath(new URL('./.e2e-ports.json', import.meta.url));
    const ports = JSON.parse(readFileSync(file, 'utf8')) as { preview?: unknown };
    const fromFile = Number(ports.preview);
    if (Number.isInteger(fromFile) && fromFile > 0) return fromFile;
  } catch {
    // No ports file in this checkout; use the default.
  }
  return 4173;
}

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    proxy,
  },
  preview: {
    port: previewPort(),
    strictPort: true,
    host: '127.0.0.1',
    proxy,
  },
  clearScreen: false,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
