// The e2e stacks' processes (every product's scripts/e2e-stack.mjs, through ./stack.mjs): the children a stack starts,
// waiting on one to finish or on a port to answer, and the shutdown that stops them all on SIGINT or SIGTERM.
// Dependency-free (node builtins), as the stacks are.

import { spawn } from 'node:child_process';
import http from 'node:http';

const children = [];
const cleanups = [];
// Something to undo as the stack goes down (a simulated deploy's copies), before its processes are stopped.
export function onShutdown(cleanup) {
  cleanups.push(cleanup);
}
export function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  return child;
}
export function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on('error', reject);
  });
}
export function shutdown(code) {
  for (const cleanup of cleanups) cleanup();
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      // best effort
    }
  }
  process.exit(code ?? 0);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

export async function waitForPort(port, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'HEAD', path: '/' }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not come up on :${port} within ${timeoutMs}ms`);
}
