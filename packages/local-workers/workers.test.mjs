import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { routeFor } from './gateway.mjs';
import { GROUPS } from './groups.mjs';
import { gatewayConfig, localConfig, parseDevScript, routesFor } from './workers.mjs';

test('a dev script splits into its steps before wrangler dev and that command’s flags', () => {
  const { steps, flags } = parseDevScript(
    'node a.ts && CI=1 wrangler d1 migrations apply db --local && wrangler dev --env local --port 3100 --local-upstream localhost:3000 --var A:x --var EMPTY: --var URL:http://localhost:3100',
  );
  assert.equal(steps, 'node a.ts && CI=1 wrangler d1 migrations apply db --local');
  assert.deepEqual(flags, {
    env: 'local',
    port: 3100,
    upstream: 'localhost:3000',
    vars: { A: 'x', EMPTY: '', URL: 'http://localhost:3100' },
  });
});

test('a dev script that is only wrangler dev has no steps', () => {
  assert.equal(parseDevScript('wrangler dev --inspector-port 9230').steps, '');
  assert.throws(() => parseDevScript('next dev'), /no `wrangler dev`/);
});

test('a local config folds in --var flags and drops routes', () => {
  const config = localConfig(
    { name: 'w', routes: [{ pattern: 'x.app/*' }], vars: { A: '1', B: '2' } },
    { vars: { B: 'local' } },
  );
  assert.deepEqual(config, { name: 'w', vars: { A: '1', B: 'local' } });
});

test('a Worker that runs with --env cannot join a group, and its other environments are dropped', () => {
  const raw = { name: 'w', vars: {}, env: { staging: { name: 'w-staging' } } };
  assert.deepEqual(localConfig(raw, { vars: {} }), { name: 'w', vars: {} });
  assert.throws(() => localConfig(raw, { env: 'local', vars: {} }), /--env local/);
});

test('the gateway binds every Worker and routes each port to it', () => {
  const workers = [
    { name: 'accounts', port: 8787, origin: 'http://localhost:3000' },
    { name: 'telemetry', port: 8790, origin: 'http://localhost:8790' },
  ];
  const config = gatewayConfig(workers, '/x/gateway.mjs');
  assert.deepEqual(config.services, [
    { binding: 'W0', service: 'accounts' },
    { binding: 'W1', service: 'telemetry' },
  ]);
  assert.deepEqual(JSON.parse(config.vars.ROUTES), routesFor(workers));
  const routes = routesFor(workers);
  assert.equal(routeFor(new Request('http://localhost:8787/a'), routes).binding, 'W0');
  const byHost = new Request('http://gateway/a', { headers: { host: 'localhost:8790' } });
  assert.equal(routeFor(byHost, routes).binding, 'W1');
  assert.equal(routeFor(new Request('http://localhost:9999/'), routes), null);
});

test('every Worker of the workspace group runs without --env and has a port of its own', () => {
  const repo = fileURLToPath(new URL('../..', import.meta.url));
  const ports = GROUPS.workspace.workers.map((dir) => {
    const dev = JSON.parse(readFileSync(path.join(repo, dir, 'package.json'), 'utf8')).scripts.dev;
    const { flags } = parseDevScript(dev);
    assert.equal(flags.env, undefined, dir);
    const toml = readFileSync(path.join(repo, dir, 'wrangler.toml'), 'utf8');
    return flags.port ?? Number(toml.match(/^\[dev\][^[]*?^port\s*=\s*(\d+)/ms)?.[1]);
  });
  assert.ok(ports.every(Number.isInteger), String(ports));
  assert.equal(new Set([...ports, GROUPS.workspace.gatewayPort]).size, ports.length + 1);
});
