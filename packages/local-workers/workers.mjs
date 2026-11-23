// What ./start.mjs needs to know about each local Worker, read from what already describes it: its package's `dev`
// script (the steps before `wrangler dev`, and that command's --port, --var and --local-upstream) and its
// wrangler.toml. Running in one `wrangler dev`, a Worker can't take its own --var flags (wrangler gives them to the
// first Worker only), so each gets a local config of its own with them folded in.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Where a Worker's folded config is written, beside its wrangler.toml so its relative paths still hold. Gitignored. */
export const LOCAL_CONFIG = 'local-workers.wrangler.json';

/** The steps a `dev` script takes before `wrangler dev` (joined back with &&) and that command's flags. */
export function parseDevScript(devScript) {
  const parts = devScript.split('&&').map((part) => part.trim());
  const at = parts.findIndex((part) => /^(\S+=\S+\s+)*wrangler\s+dev\b/.test(part));
  if (at === -1) throw new Error(`no \`wrangler dev\` in: ${devScript}`);
  const words = parts[at].split(/\s+/);
  const flags = { vars: {} };
  for (let i = 0; i < words.length; i++) {
    const value = words[i + 1];
    if (words[i] === '--port') flags.port = Number(value);
    else if (words[i] === '--env') flags.env = value;
    else if (words[i] === '--local-upstream') flags.upstream = value;
    else if (words[i] === '--var') {
      const colon = value.indexOf(':');
      flags.vars[value.slice(0, colon)] = value.slice(colon + 1);
    }
  }
  return { steps: parts.slice(0, at).join(' && '), flags };
}

/**
 * The config a Worker runs on locally: its top level (one `wrangler dev` takes a single --env for every Worker, so a
 * Worker whose dev script names one can't join a group), its --var flags folded in, no routes (nothing local uses them).
 */
export function localConfig(raw, flags) {
  if (flags.env)
    throw new Error(
      `${raw.name} runs with --env ${flags.env}, which a group can't give one Worker alone`,
    );
  const { env: _env, routes: _routes, route: _route, ...config } = raw;
  return { ...config, vars: { ...config.vars, ...flags.vars } };
}

/** A Worker of a group, as ./start.mjs runs it, with its local config written. */
export function prepareWorker(repoRoot, dir, offset = 0) {
  const abs = path.join(repoRoot, dir);
  const pkg = JSON.parse(readFileSync(path.join(abs, 'package.json'), 'utf8'));
  const { steps, flags } = parseDevScript(pkg.scripts.dev);
  const wrangler = createRequire(path.join(abs, 'package.json'))('wrangler');
  const { rawConfig } = wrangler.experimental_readRawConfig({
    config: path.join(abs, 'wrangler.toml'),
  });
  const config = localConfig(rawConfig, flags);
  const base = flags.port ?? rawConfig.dev?.port;
  if (!base)
    throw new Error(`${dir}: no --port in its dev script and no [dev] port in its wrangler.toml`);
  const port = base + offset;
  const file = path.join(abs, LOCAL_CONFIG);
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return {
    dir: abs,
    name: config.name,
    config: file,
    steps,
    port,
    origin: `http://${flags.upstream ?? `localhost:${port}`}`,
  };
}

/** The gateway's ROUTES var: each Worker's port to its binding and the origin it sees requests on. */
export function routesFor(workers) {
  return Object.fromEntries(
    workers.map((worker, i) => [String(worker.port), { binding: `W${i}`, origin: worker.origin }]),
  );
}

/** The gateway's wrangler config: a service binding to each Worker, and the routes. */
export function gatewayConfig(workers, gatewayMain) {
  return {
    name: 'local-workers-gateway',
    main: gatewayMain,
    compatibility_date: '2026-05-29',
    services: workers.map((worker, i) => ({ binding: `W${i}`, service: worker.name })),
    vars: { ROUTES: JSON.stringify(routesFor(workers)) },
  };
}
