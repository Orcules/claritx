/**
 * Manages the vite preview server lifecycle and runs prerender.js.
 *
 * Modes:
 *   node scripts/build-with-prerender.js               — vite build + prerender
 *   node scripts/build-with-prerender.js --prerender-only — prerender only (dist already built)
 */

import { spawn } from 'child_process';
import { createConnection } from 'net';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PREVIEW_PORT = 4173;
const prerenderOnly = process.argv.includes('--prerender-only');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: ROOT });
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitForPort(port, retries = 30, delay = 500) {
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, delay));
    const ok = await new Promise(r => {
      const s = createConnection(port, 'localhost');
      s.on('connect', () => { s.destroy(); r(true); });
      s.on('error', () => r(false));
    });
    if (ok) return;
  }
  throw new Error(`Port ${port} never became available after ${retries * delay}ms`);
}

async function main() {
  if (!prerenderOnly) {
    console.log('\n[build-with-prerender] Running vite build...');
    await run('npx', ['vite', 'build']);
  }

  console.log(`\n[build-with-prerender] Starting preview server on :${PREVIEW_PORT}...`);
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT)], {
    stdio: 'inherit', shell: true, cwd: ROOT,
  });

  let exitCode = 0;
  try {
    await waitForPort(PREVIEW_PORT);
    console.log('[build-with-prerender] Preview server ready.');

    console.log('\n[build-with-prerender] Running prerender.js...');
    await run('node', ['scripts/prerender.js']);
    console.log('\n[build-with-prerender] Pre-rendering complete.');
  } catch (err) {
    console.error('[build-with-prerender] Error:', err.message);
    exitCode = 1;
  } finally {
    preview.kill('SIGTERM');
  }

  process.exit(exitCode);
}

main();
