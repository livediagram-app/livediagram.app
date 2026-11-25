// Makes sure a Worker's D1 database exists before its migrations apply (docs/ci.md "Deploys", "A new database").
//
// A Worker's wrangler.toml names each database and pins its id. A new Worker can leave the id as the
// placeholder `00000000-0000-0000-0000-000000000000`: on its first deploy this finds the database by name, or
// creates it (in Western Europe, where every other database is), and writes the id into the checkout's
// wrangler.toml for the steps after it. The repository is never changed: the job says to pin the id, so local
// remote reads (`wrangler d1 execute --remote`) find the same database. A pinned id costs nothing: no API call.
//
//   node .github/scripts/ensure-d1.mjs <binding> [--env staging]     (in the Worker's folder)

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000';

/** Where a new database lives: every liveworkspace database is in Western Europe. */
export const LOCATION = 'weur';

const HEADER = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*$/;
const STRING = (key) => new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`);

/**
 * The environment's D1 block for `binding`: its database name and id, and the line the id is on.
 * Production's blocks are `[[d1_databases]]`; staging's `[[env.staging.d1_databases]]`.
 */
export function findDatabase(config, binding, environment) {
  const table = environment === 'staging' ? 'env.staging.d1_databases' : 'd1_databases';
  const lines = config.split('\n');
  let block = null;
  const blocks = [];
  lines.forEach((line, index) => {
    const header = line.match(HEADER);
    if (header) {
      block = header[1] === table ? { name: '', id: '', binding: '', idLine: -1 } : null;
      if (block) blocks.push(block);
      return;
    }
    if (!block) return;
    const name = line.match(STRING('database_name'));
    const id = line.match(STRING('database_id'));
    const bound = line.match(STRING('binding'));
    if (name) block.name = name[1];
    if (bound) block.binding = bound[1];
    if (id) {
      block.id = id[1];
      block.idLine = index;
    }
  });
  return blocks.find((b) => b.binding === binding) ?? null;
}

/** The config with the id on `line` set to `id`. */
export function pinId(config, line, id) {
  const lines = config.split('\n');
  lines[line] = lines[line].replace(/"[^"]*"/, `"${id}"`);
  return lines.join('\n');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Finds the database or makes it. `wrangler` runs a wrangler command and answers `{ status, stdout }`.
 * Answers `{ ok, id, created, message }`.
 */
export function ensureDatabase({ binding, environment, config, wrangler }) {
  const found = findDatabase(config, binding, environment);
  if (!found || !found.name) {
    return { ok: false, message: `no [[d1_databases]] block with binding ${binding}` };
  }
  if (found.id && found.id !== PLACEHOLDER_ID) return { ok: true, id: found.id, created: false };
  if (found.idLine < 0) {
    return { ok: false, message: `${found.name} has no database_id line to fill in` };
  }

  const list = wrangler(['d1', 'list', '--json']);
  if (list.status !== 0) return { ok: false, message: 'wrangler d1 list failed' };
  let databases;
  try {
    databases = JSON.parse(list.stdout);
  } catch {
    return { ok: false, message: 'wrangler d1 list answered something other than JSON' };
  }
  const existing = databases.find((d) => d.name === found.name);
  if (existing && UUID.test(existing.uuid)) {
    return { ok: true, id: existing.uuid, created: false, name: found.name, line: found.idLine };
  }

  const made = wrangler(['d1', 'create', found.name, '--location', LOCATION]);
  if (made.status !== 0) return { ok: false, message: `wrangler d1 create ${found.name} failed` };
  const id = made.stdout.match(/"database_id":\s*"([0-9a-f-]{36})"/)?.[1];
  if (!id || !UUID.test(id)) {
    return { ok: false, message: `created ${found.name} but could not read its id` };
  }
  return { ok: true, id, created: true, name: found.name, line: found.idLine };
}

/** The real wrangler, run with the Worker's own pnpm install. */
const spawnWrangler = (cwd) => (args) => {
  const run = spawnSync('pnpm', ['exec', 'wrangler', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 120_000,
  });
  return { status: run.error ? 1 : (run.status ?? 1), stdout: run.stdout ?? '' };
};

export function main(
  argv = process.argv.slice(2),
  { cwd = process.cwd(), log = console.log, wrangler = spawnWrangler(cwd) } = {},
) {
  const binding = argv[0];
  const environment = argv.includes('--env') ? argv[argv.indexOf('--env') + 1] : 'production';
  if (!binding) {
    console.error('usage: ensure-d1.mjs <binding> [--env staging]');
    return 2;
  }
  const file = `${cwd}/wrangler.toml`;
  const config = readFileSync(file, 'utf8');
  const result = ensureDatabase({ binding, environment, config, wrangler });
  if (!result.ok) {
    log(`::error title=D1 database::${result.message}`);
    return 1;
  }
  if (result.line === undefined) return 0;
  writeFileSync(file, pinId(config, result.line, result.id));
  log(
    `::notice title=Pin ${result.name}::${result.created ? 'Created' : 'Found'} D1 ${result.name} (${result.id}). Put this id in its wrangler.toml in place of the placeholder.`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
