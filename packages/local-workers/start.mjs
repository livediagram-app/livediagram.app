// Runs a group of local Workers (./groups.mjs) in ONE `wrangler dev`: one Node process, one workerd and one bundler
// for all of them, where each used to start its own (liveworkspace's eight Workers peaked at 3.5 GB that way, 1.3 GB this way).
// Each Worker keeps its own port, `.dev.vars`, migrations and local data. Local only: deploys and CI never run this.
//
//   node packages/local-workers/start.mjs workspace      (`dev:workspace` runs it through turbo with LOCAL_WORKERS set)
//
// 1. Each Worker's own pre-dev steps, as its `dev` script runs them (`.dev.vars`, local D1 migrations, seeds), after
//    its `.wrangler/state` is linked to the group's shared state (./state.mjs).
// 2. `wrangler dev -c <gateway> -c <each Worker>`: the gateway (./gateway.mjs) is the one Worker wrangler serves.
// 3. A pipe from each Worker's own port to the gateway (./forward.mjs), which hands the request to that Worker.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { forward } from './forward.mjs';
import { GROUPS } from './groups.mjs';
import { shareState } from './state.mjs';
import { gatewayConfig, prepareWorker } from './workers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

// The group: an argument, or LOCAL_WORKERS from a root `dev:*` script. A bare `turbo run dev` names none, and runs
// every Worker's own `wrangler dev` instead, so there is nothing to do here.
const name = process.argv[2] ?? process.env.LOCAL_WORKERS;
if (!name) process.exit(0);
const group = GROUPS[name];
if (!group) {
  console.error(`Usage: node packages/local-workers/start.mjs <${Object.keys(GROUPS).join('|')}>`);
  process.exit(1);
}

const children = new Set();
const servers = [];
function stop(code) {
  for (const server of servers) server.close();
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

function sh(command, cwd, label) {
  return new Promise((resolve, reject) => {
    const bin = path.join(cwd, 'node_modules', '.bin');
    const child = spawn('sh', ['-c', command], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
    children.add(child);
    const prefix = (chunk) =>
      chunk
        .toString()
        .split('\n')
        .filter(Boolean)
        .map((line) => `[${label}] ${line}`)
        .join('\n');
    child.stdout.on('data', (chunk) => console.log(prefix(chunk)));
    child.stderr.on('data', (chunk) => console.error(prefix(chunk)));
    child.on('exit', (code) => {
      children.delete(child);
      code === 0 ? resolve() : reject(new Error(`${label}: \`${command}\` exited ${code}`));
    });
  });
}

function waitForPort(port, timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > until) reject(new Error(`nothing answered on ${port}`));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

// LOCAL_WORKERS_PORT_OFFSET moves every port the group listens on (its Workers', its gateway's, its inspector's), to
// run or measure a second copy beside one already up. The Workers' vars still name the usual ports, so a request that
// calls on to another Worker reaches the usual stack: give such a copy its own WRANGLER_REGISTRY_PATH as well.
const OFFSET = Number(process.env.LOCAL_WORKERS_PORT_OFFSET ?? 0);
const gatewayPort = group.gatewayPort + OFFSET;
const workers = group.workers.map((dir) => prepareWorker(REPO, dir, OFFSET));
const root = path.join(REPO, group.root);
const shared = path.join(root, '.wrangler', 'local-workers', 'state');

// 1. Shared state, then each Worker's own steps, one Worker at a time.
for (const worker of workers) {
  const result = shareState(worker.dir, shared);
  if (result.outcome === 'merged') {
    console.log(
      `[${worker.name}] local data moved into ${path.relative(REPO, shared)} (old folder kept at ${path.relative(REPO, result.kept)})`,
    );
  } else if (result.outcome === 'foreign') {
    console.warn(
      `[${worker.name}] .wrangler/state links elsewhere; left alone, so its migrations may not reach this run`,
    );
  }
}
// One at a time: each step that touches local D1 (migrations, seeds) opens the one shared state folder, and two at
// once fail with SQLITE_BUSY on its metadata database.
try {
  for (const w of workers.filter((worker) => worker.steps)) await sh(w.steps, w.dir, w.name);
} catch (error) {
  console.error(error.message);
  stop(1);
}

// 2. One wrangler dev for the gateway and every Worker.
const gatewayDir = path.join(root, '.wrangler', 'local-workers', 'gateway');
mkdirSync(gatewayDir, { recursive: true });
const gatewayFile = path.join(gatewayDir, 'wrangler.json');
writeFileSync(
  gatewayFile,
  JSON.stringify(gatewayConfig(workers, path.join(HERE, 'gateway.mjs')), null, 2),
);
const wrangler = spawn(
  path.join(workers[0].dir, 'node_modules', '.bin', 'wrangler'),
  [
    'dev',
    '-c',
    gatewayFile,
    ...workers.flatMap((worker) => ['-c', worker.config]),
    '--port',
    String(gatewayPort),
    '--inspector-port',
    String(group.inspectorPort + OFFSET),
    '--persist-to',
    shared,
  ],
  { cwd: root, stdio: 'inherit' },
);
children.add(wrangler);
wrangler.on('exit', (code) => {
  children.delete(wrangler);
  stop(code ?? 1);
});

// 3. Each Worker's own port, once the gateway answers.
await waitForPort(gatewayPort);
try {
  for (const worker of workers) servers.push(...(await forward(worker.port, gatewayPort)));
} catch (error) {
  console.error(
    `Port ${error.port} is taken: stop whatever holds it (lsof -nP -iTCP:${error.port} -sTCP:LISTEN), then restart.`,
  );
  stop(1);
}
console.log(
  `\n${workers.length} Workers in one process: ${workers.map((w) => `${w.name.replace(/^liveworkspace-/, '')} :${w.port}`).join(', ')}\n`,
);
