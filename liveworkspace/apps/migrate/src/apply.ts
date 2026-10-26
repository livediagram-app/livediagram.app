// `migrate apply <bundle> --env staging|production [--dry-run]` (docs/migration.md "Tooling"): runs a bundle's steps
// in the manifest's order (accounts, index, media; the R2 copies; the rooms through each app's migration door;
// community; the MCP's KV), recording each unit in the ledger as soon as it has succeeded, so a stopped run resumes
// where it left off and never repeats a finished unit.
//
// Every command and request is built here and handed to a Runner and an Http (real ones in ./run.ts); the tests use
// fakes. `--dry-run` prints them all and runs none, and needs no credentials.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MigrationApp, MigrationDoorAnswer } from '@liveworkspace/migration';
import { Ledger, type LedgerRow } from './ledger.ts';
import type { RoomLine, R2Entry } from './plan/files.ts';
import type { Manifest } from './plan/index.ts';
import { KV_MIN_TTL_SECONDS, type KvPut } from './plan/kv.ts';
import type { Db, LedgerEntry } from './sql.ts';
import {
  configOf,
  databaseOf,
  keyVar,
  MCP_CONFIG,
  mediaBucketOf,
  OAUTH_KV,
  OLD_IMAGES_BUCKET,
  originVar,
  REPO_ROOT,
  SOURCE_ACCOUNT_VAR,
  SOURCE_TOKEN_VAR,
  TARGET_TOKEN_VAR,
  type Env,
} from './targets.ts';

/** One wrangler run. `env` is the whole environment it gets (nothing is inherited beyond PATH and HOME). */
export type Command = { argv: string[]; env: Record<string, string>; cwd: string };
export type RunResult = { code: number; stdout: string; stderr: string };
export interface Runner {
  run(command: Command): Promise<RunResult>;
}

export type HttpRequest = {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  body: string;
};
export type HttpResponse = { status: number; body: string };
export interface Http {
  send(request: HttpRequest): Promise<HttpResponse>;
}

export type ApplyOptions = {
  bundleDir: string;
  env: Env;
  ledgerPath: string;
  dryRun: boolean;
  runner: Runner;
  http: Http;
  /** The variables the run reads its credentials and origins from (process.env in the CLI). */
  vars: Record<string, string | undefined>;
  /** The wrangler command (default: the repository's own). */
  wrangler?: string[];
  concurrency?: number;
  log?: (line: string) => void;
  now?: () => number;
};

export type ApplySummary = {
  ran: number;
  skipped: number;
  edited: { app: string; id: string; tabs: string[] }[];
};

const DEFAULT_CONCURRENCY = 8;

export const defaultWrangler = (): string[] => [
  join(REPO_ROOT, 'node_modules', '.bin', 'wrangler'),
];

// What a wrangler run may see of the caller's environment: enough to find node and its cache, no credentials.
const PASSED_THROUGH = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'NODE_OPTIONS', 'XDG_CONFIG_HOME'];

function need(vars: ApplyOptions['vars'], name: string, dryRun: boolean): string {
  const v = vars[name];
  if (v) return v;
  if (dryRun) return `$${name}`;
  throw new Error(`${name} is not set (see liveworkspace/apps/migrate/README.md)`);
}

/** The base environment of a run: the passed-through variables only. */
function baseEnv(vars: ApplyOptions['vars']): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of PASSED_THROUGH) if (vars[name]) env[name] = vars[name]!;
  // No prompts, no telemetry: a run is unattended.
  env.CI = 'true';
  env.WRANGLER_SEND_METRICS = 'false';
  return env;
}

// ---- The commands, built on their own so the tests can check them ------------------------------------------------

export function d1Command(o: {
  wrangler: string[];
  db: Db;
  env: Env;
  file: string;
  token: string;
  base: Record<string, string>;
}): Command {
  return {
    argv: [
      ...o.wrangler,
      'd1',
      'execute',
      databaseOf(o.db, o.env),
      '--remote',
      '--yes',
      '--file',
      o.file,
      '--config',
      join(REPO_ROOT, configOf(o.db)),
      ...(o.env === 'staging' ? ['--env', 'staging'] : []),
    ],
    env: { ...o.base, CLOUDFLARE_API_TOKEN: o.token },
    cwd: REPO_ROOT,
  };
}

/** Reads an object from the old bucket, on the old account: no config file, so nothing can point it elsewhere. */
export function r2GetCommand(o: {
  wrangler: string[];
  key: string;
  file: string;
  accountId: string;
  token: string;
  cwd: string;
  base: Record<string, string>;
}): Command {
  return {
    argv: [
      ...o.wrangler,
      'r2',
      'object',
      'get',
      `${OLD_IMAGES_BUCKET}/${o.key}`,
      '--file',
      o.file,
      '--remote',
    ],
    env: { ...o.base, CLOUDFLARE_ACCOUNT_ID: o.accountId, CLOUDFLARE_API_TOKEN: o.token },
    cwd: o.cwd,
  };
}

export function r2PutCommand(o: {
  wrangler: string[];
  env: Env;
  key: string;
  file: string;
  contentType: string;
  token: string;
  base: Record<string, string>;
}): Command {
  return {
    argv: [
      ...o.wrangler,
      'r2',
      'object',
      'put',
      `${mediaBucketOf(o.env)}/${o.key}`,
      '--file',
      o.file,
      '--content-type',
      o.contentType,
      '--remote',
      '--config',
      join(REPO_ROOT, configOf('media')),
    ],
    env: { ...o.base, CLOUDFLARE_API_TOKEN: o.token },
    cwd: REPO_ROOT,
  };
}

export function kvBulkPutCommand(o: {
  wrangler: string[];
  env: Env;
  file: string;
  token: string;
  base: Record<string, string>;
}): Command {
  return {
    argv: [
      ...o.wrangler,
      'kv',
      'bulk',
      'put',
      o.file,
      '--namespace-id',
      OAUTH_KV[o.env],
      '--remote',
      '--config',
      join(REPO_ROOT, MCP_CONFIG),
    ],
    env: { ...o.base, CLOUDFLARE_API_TOKEN: o.token },
    cwd: REPO_ROOT,
  };
}

export function roomRequest(o: {
  origin: string;
  key: string;
  app: MigrationApp;
  id: string;
  body: string;
}): HttpRequest {
  return {
    method: 'PUT',
    url: `${o.origin.replace(/\/+$/, '')}/api/internal/items/${encodeURIComponent(o.id)}/migration`,
    headers: { authorization: `Bearer ${o.key}`, 'content-type': 'application/json' },
    body: o.body,
  };
}

/** A command as printed: secrets shown by name only. */
export function describe(command: Command, secrets: readonly string[]): string {
  const shown = (s: string) => (secrets.includes(s) ? '***' : s);
  const env = Object.entries(command.env)
    .filter(([k]) => k.startsWith('CLOUDFLARE_'))
    .map(
      ([k, v]) =>
        `${k}=${k === 'CLOUDFLARE_API_TOKEN' ? (v.startsWith('$') ? v : '***') : shown(v)}`,
    );
  return [...env, ...command.argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a))].join(' ');
}

async function pool<T>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed: unknown = null;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (failed === null && next < items.length) {
      const item = items[next++]!;
      try {
        await work(item);
      } catch (error) {
        failed ??= error;
      }
    }
  });
  await Promise.all(runners);
  if (failed !== null) throw failed instanceof Error ? failed : new Error(JSON.stringify(failed));
}

const readLedgerEntries = (bundleDir: string, db: Db, sqlFile: string): LedgerRow[] => {
  const ledgerFile = join(
    bundleDir,
    sqlFile.replace(/^sql\//, 'ledger/').replace(/\.sql$/, '.jsonl'),
  );
  return readFileSync(ledgerFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [table, key, version] = JSON.parse(line) as LedgerEntry;
      return [db, table, key, version];
    });
};

export async function apply(o: ApplyOptions): Promise<ApplySummary> {
  const log = o.log ?? ((line: string) => console.log(line));
  const manifest = JSON.parse(readFileSync(join(o.bundleDir, 'manifest.json'), 'utf8')) as Manifest;
  const wrangler = o.wrangler ?? defaultWrangler();
  const base = baseEnv(o.vars);
  const concurrency = o.concurrency ?? DEFAULT_CONCURRENCY;
  const now = o.now ?? Date.now;
  const summary: ApplySummary = { ran: 0, skipped: 0, edited: [] };
  if (o.env !== 'staging' && o.env !== 'production')
    throw new Error(`--env must be staging or production`);
  // `--concurrency abc` or 0 would start no workers at all, so the R2 objects and rooms would be skipped while the run
  // still reported success.
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new Error('--concurrency must be a whole number, 1 or more');

  const targetToken = need(o.vars, TARGET_TOKEN_VAR, o.dryRun);
  const secrets = [targetToken];
  // A dry run reads the ledger if there is one, to show what a real run would skip; it never writes it.
  const ledger = o.dryRun
    ? (() => {
        try {
          return Ledger.open(o.ledgerPath);
        } catch {
          return Ledger.open(null);
        }
      })()
    : Ledger.open(o.ledgerPath, { create: true });
  const bundle = manifest.bundle;
  const done = (unit: string) => ledger.isDone(bundle, unit);
  const mark = (unit: string, rows: LedgerRow[]) => {
    if (!o.dryRun) ledger.markDone(bundle, unit, rows, now());
    summary.ran++;
  };
  const run = async (command: Command, what: string) => {
    log(`${o.dryRun ? '[dry-run] ' : ''}${what}: ${describe(command, secrets)}`);
    if (o.dryRun) return { code: 0, stdout: '', stderr: '' };
    const result = await o.runner.run(command);
    if (result.code !== 0) {
      throw new Error(
        `${what} failed (exit ${result.code}): ${result.stderr.trim() || result.stdout.trim()}`,
      );
    }
    return result;
  };

  try {
    if (!o.dryRun) ledger.begin(bundle, manifest.ledgerGeneration);
    else if (!ledger.inProgress() && ledger.generation() !== manifest.ledgerGeneration) {
      log(
        `[dry-run] note: planned at ledger generation ${manifest.ledgerGeneration}, ledger is at ${ledger.generation()}: a real run would refuse`,
      );
    }
    for (const step of manifest.steps) {
      if (step.step === 'sql') {
        for (const file of step.files) {
          if (done(file)) {
            summary.skipped++;
            continue;
          }
          await run(
            d1Command({
              wrangler,
              db: step.db,
              env: o.env,
              file: join(o.bundleDir, file),
              token: targetToken,
              base,
            }),
            `${step.db} ${file}`,
          );
          mark(file, readLedgerEntries(o.bundleDir, step.db, file));
        }
      } else if (step.step === 'r2') {
        const entries = JSON.parse(readFileSync(join(o.bundleDir, step.file), 'utf8')) as R2Entry[];
        const pending = entries.filter((e) => {
          const skip = done(`r2:${e.key}`);
          if (skip) summary.skipped++;
          return !skip;
        });
        if (pending.length === 0) continue;
        const sourceAccount = pending.some((e) => !e.file)
          ? need(o.vars, SOURCE_ACCOUNT_VAR, o.dryRun)
          : '';
        const sourceToken = pending.some((e) => !e.file)
          ? need(o.vars, SOURCE_TOKEN_VAR, o.dryRun)
          : '';
        secrets.push(sourceToken);
        const scratch = mkdtempSync(join(tmpdir(), 'migrate-r2-'));
        try {
          await pool(pending, concurrency, async (e) => {
            const file = e.file ? join(o.bundleDir, e.file) : join(scratch, e.key);
            if (!e.file) {
              await run(
                r2GetCommand({
                  wrangler,
                  key: e.key,
                  file,
                  accountId: sourceAccount,
                  token: sourceToken,
                  cwd: scratch,
                  base,
                }),
                `r2 get ${e.key}`,
              );
            }
            if (!o.dryRun) {
              const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
              if (sha !== e.sha256)
                throw new Error(`r2 ${e.key}: the bytes read have SHA-256 ${sha}, not ${e.sha256}`);
            }
            await run(
              r2PutCommand({
                wrangler,
                env: o.env,
                key: e.key,
                file,
                contentType: e.contentType,
                token: targetToken,
                base,
              }),
              `r2 put ${e.key}`,
            );
            if (!e.file && !o.dryRun) rmSync(file, { force: true });
            mark(`r2:${e.key}`, [['r2', 'objects', e.key, e.version]]);
          });
        } finally {
          rmSync(scratch, { recursive: true, force: true });
        }
      } else if (step.step === 'rooms') {
        const lines = readFileSync(join(o.bundleDir, step.file), 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l) as RoomLine);
        const pending = lines.filter(([app, id]) => {
          const skip = done(`rooms:${app}/${id}`);
          if (skip) summary.skipped++;
          return !skip;
        });
        await pool(pending, concurrency, async ([app, id, version]) => {
          const a = app as MigrationApp;
          const origin = need(o.vars, originVar(a), o.dryRun);
          const key = need(o.vars, keyVar(a), o.dryRun);
          if (!secrets.includes(key)) secrets.push(key);
          const request = roomRequest({
            origin,
            key,
            app: a,
            id,
            body: o.dryRun
              ? ''
              : readFileSync(join(o.bundleDir, 'rooms', app, `${id}.json`), 'utf8'),
          });
          log(
            `${o.dryRun ? '[dry-run] ' : ''}room ${app}/${id}: PUT ${request.url} (Bearer $${keyVar(a)})`,
          );
          if (!o.dryRun) {
            const response = await o.http.send(request);
            if (response.status < 200 || response.status >= 300) {
              throw new Error(
                `room ${app}/${id}: the door answered ${response.status}: ${response.body.slice(0, 500)}`,
              );
            }
            const answer = JSON.parse(response.body) as MigrationDoorAnswer;
            if (answer.edited?.length) summary.edited.push({ app, id, tabs: answer.edited });
          }
          mark(`rooms:${app}/${id}`, [['rooms', app, id, version]]);
        });
      } else if (step.step === 'kv') {
        if (done('kv') || step.count === 0) {
          if (step.count) summary.skipped++;
          continue;
        }
        const puts = JSON.parse(readFileSync(join(o.bundleDir, step.file), 'utf8')) as KvPut[];
        // Time has passed since the plan: a registration about to lapse is left out rather than refused.
        const cutoff = Math.floor(now() / 1000) + KV_MIN_TTL_SECONDS;
        const live = puts.filter((p) => p.expiration === undefined || p.expiration > cutoff);
        const scratch = mkdtempSync(join(tmpdir(), 'migrate-kv-'));
        try {
          const file = join(scratch, 'mcp-clients.json');
          writeFileSync(file, JSON.stringify(live));
          await run(
            kvBulkPutCommand({ wrangler, env: o.env, file, token: targetToken, base }),
            `kv ${live.length} clients`,
          );
        } finally {
          rmSync(scratch, { recursive: true, force: true });
        }
        mark(
          'kv',
          live.map((p) => [
            'kv',
            'clients',
            p.key,
            JSON.stringify(createHash('sha256').update(p.value).digest('hex')),
          ]),
        );
      }
    }
    if (!o.dryRun) ledger.finish(bundle);
    for (const e of summary.edited)
      log(`edited on the new side, left alone: ${e.app}/${e.id} tabs ${e.tabs.join(', ')}`);
    log(
      `${o.dryRun ? '[dry-run] ' : ''}${summary.ran} units ${o.dryRun ? 'would run' : 'ran'}, ${summary.skipped} already done`,
    );
    return summary;
  } finally {
    ledger.close();
  }
}
