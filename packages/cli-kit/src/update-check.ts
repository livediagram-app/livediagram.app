// The update check (each product's docs/specs/015-api/blueprints/cli.md "Update check", CLI43). Once a day at most, a
// command that exits 0 starts a detached copy of the CLI in the background, which asks the npm registry for the
// package's `latest` and stores it; the command never waits for it. A stored version newer than the running one is
// named in one stderr line after a command that exits 0, at most once a day. Every failure is swallowed: the check
// never slows or fails a command.

import { debugLog } from './debug';
import type { CliIo } from './io';
import { configDir } from './paths';
import type { CliProduct } from './product';
import { isBelow } from './version';

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_CHECK_TIMEOUT_MS = 1500;
// The argument the background copy runs with: it asks npm and stores the answer, and runs no command.
export const UPDATE_CHECK_ARG = '--update-check-background';

type Product = Pick<CliProduct, 'name' | 'envPrefix' | 'npmPackage' | 'version'>;

// x.y.z with an optional pre-release and build: what a version must look like to be compared at all.
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const updateFile = (io: CliIo, product: Pick<CliProduct, 'name'>) =>
  `${configDir(io, product)}/update.json`;

export const registryUrl = (npmPackage: string) =>
  `https://registry.npmjs.org/-/package/${npmPackage.replaceAll('/', '%2F')}/dist-tags`;

// Why the check does not run here, or null when it may.
export function skipReason(io: CliIo, product: Pick<CliProduct, 'envPrefix'>): string | null {
  if (io.env.CI) return 'ci';
  if (!io.stderrIsTTY) return 'not-a-terminal';
  if (io.env[`${product.envPrefix}_NO_UPDATE_CHECK`] === '1') return 'opted-out';
  return null;
}

// Whether `latest` is worth telling someone on `current` about: newer by semver, and a pre-release only to someone
// already on one.
export function isNewer(current: string, latest: string): boolean {
  if (!SEMVER.test(latest) || !SEMVER.test(current)) return false;
  if (latest.split('+')[0]!.includes('-') && !current.split('+')[0]!.includes('-')) return false;
  return isBelow(current, latest);
}

export const updateNotice = (product: Product, latest: string) =>
  `${product.name} ${latest} is out (you have ${product.version}). Update: npm i -g ${product.npmPackage}`;

// `update.json`: when npm was last asked, what it answered, and when the notice was last shown.
type Stored = { checkedAt: number; latest: string | null; notifiedAt: number };

const EMPTY: Stored = { checkedAt: 0, latest: null, notifiedAt: 0 };

const time = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

async function readStored(io: CliIo, path: string): Promise<Stored> {
  try {
    const value = JSON.parse((await io.files.read(path)) ?? 'null') as Record<
      string,
      unknown
    > | null;
    if (!value || typeof value !== 'object') return EMPTY;
    return {
      checkedAt: time(value.checkedAt),
      latest: typeof value.latest === 'string' && SEMVER.test(value.latest) ? value.latest : null,
      notifiedAt: time(value.notifiedAt),
    };
  } catch {
    return EMPTY;
  }
}

const writeStored = (io: CliIo, path: string, stored: Stored) =>
  io.files.write(path, `${JSON.stringify(stored)}\n`);

// Older than a day, or in the future (a clock set back).
const stale = (at: number, now: number) => at > now || now - at >= UPDATE_CHECK_INTERVAL_MS;

async function fetchLatest(io: CliIo, npmPackage: string): Promise<string | null> {
  const response = await io.fetch(
    new Request(registryUrl(npmPackage), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS),
    }),
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { latest?: unknown } | null;
  return typeof body?.latest === 'string' && SEMVER.test(body.latest) ? body.latest : null;
}

// The background copy's work: ask npm and store the answer beside what the file holds. A failure stores nothing; the
// command that started it already marked the check done for the day.
export async function refreshLatest(io: CliIo, product: Product): Promise<void> {
  const debug = debugLog(io, product);
  const path = updateFile(io, product);
  try {
    const latest = await fetchLatest(io, product.npmPackage);
    debug(latest ? `update-check latest ${latest}` : 'update-check failed');
    if (!latest) return;
    const stored = await readStored(io, path);
    await writeStored(io, path, { ...stored, checkedAt: io.now(), latest });
  } catch {
    debug('update-check failed');
  }
}

// After a command: the notice to print (after an exit 0, at most once a day), and, when npm was last asked a day ago
// or more, the check marked done for the day and a background copy started to ask it. Null when there is nothing to
// say. Never throws.
export async function finishUpdateCheck(
  io: CliIo,
  product: Product,
  exitCode: number,
  startBackground: () => void,
): Promise<string | null> {
  const debug = debugLog(io, product);
  const reason = exitCode === 0 ? skipReason(io, product) : 'failed-command';
  if (reason) {
    debug(`update-check skipped ${reason}`);
    return null;
  }
  try {
    const now = io.now();
    const path = updateFile(io, product);
    const stored = await readStored(io, path);
    const due = stale(stored.checkedAt, now);
    const notice =
      stored.latest && isNewer(product.version, stored.latest) && stale(stored.notifiedAt, now)
        ? updateNotice(product, stored.latest)
        : null;
    if (!due && !notice) {
      debug('update-check skipped checked-today');
      return null;
    }
    await writeStored(io, path, {
      ...stored,
      ...(due ? { checkedAt: now } : {}),
      ...(notice ? { notifiedAt: now } : {}),
    });
    if (due) {
      debug('update-check started');
      startBackground();
    }
    return notice;
  } catch {
    debug('update-check failed');
    return null;
  }
}

// What `runBin` runs: the check after each command, and the background copy's work when started with
// UPDATE_CHECK_ARG.
export type BinUpdate = {
  finish: (exitCode: number) => Promise<string | null>;
  refresh: () => Promise<void>;
};

export const binUpdate = (io: CliIo, product: Product): BinUpdate => ({
  finish: (exitCode) =>
    finishUpdateCheck(io, product, exitCode, () => io.runBackground([UPDATE_CHECK_ARG])),
  refresh: () => refreshLatest(io, product),
});
