// Shared steps of the plan tests: plan the scenario into a fresh folder, and stand in for `apply` against local
// SQLite (each SQL file run, then the ledger rows recorded as apply would).
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Ledger, type LedgerRow } from '../src/ledger.ts';
import type { PictureDrawer } from '../src/pictures.ts';
import type { SplitFn } from '../src/plan/documents.ts';
import type { RoomLine } from '../src/plan/files.ts';
import { plan, type Manifest } from '../src/plan/index.ts';
import type { Db, LedgerEntry } from '../src/sql.ts';
import { NOW } from './fixture.ts';
import { CLERK, EXISTING } from './scenario.ts';

export const tempDir = (name: string) => mkdtempSync(join(tmpdir(), `migrate-${name}-`));

/** A picture drawer that draws nothing real: a few bytes named after what it was asked for. */
export const fakeDrawer: PictureDrawer = async (input, picture) =>
  Promise.resolve({
    png: Buffer.from(`png:${input.document.id}:${picture.tabId}:${picture.elementId}`),
    width: 64,
    height: 32,
  });

export async function planScenario(
  snapshot: DatabaseSync,
  options: {
    out?: string;
    ledgerPath?: string;
    drawPicture?: PictureDrawer | null;
    split?: SplitFn;
    oauthKvPath?: string;
    clerkCsv?: string;
  } = {},
) {
  const outDir = options.out ?? join(tempDir('bundle'), 'b');
  const result = await plan({
    snapshot,
    snapshotMeta: {
      exportSha256: 'fixture',
      level: '0099_workbench_workspace.sql',
      snapshotAt: NOW,
    },
    clerkCsv: options.clerkCsv ?? CLERK,
    existingAccounts: EXISTING,
    ledgerPath: options.ledgerPath ?? null,
    oauthKvPath: options.oauthKvPath ?? null,
    outDir,
    drawPicture: options.drawPicture === undefined ? fakeDrawer : options.drawPicture,
    split: options.split,
  });
  return { ...result, outDir };
}

export const sqlFiles = (manifest: Manifest): Record<Db, string[]> => {
  const out = {} as Record<Db, string[]>;
  for (const s of manifest.steps) if (s.step === 'sql') out[s.db] = s.files;
  return out;
};

export function runSql(outDir: string, manifest: Manifest, dbs: Record<Db, DatabaseSync>): void {
  for (const s of manifest.steps) {
    if (s.step !== 'sql') continue;
    for (const f of s.files) dbs[s.db].exec(readFileSync(join(outDir, f), 'utf8'));
  }
}

/** Records the bundle in the ledger as a finished apply would. */
export function recordApplied(outDir: string, manifest: Manifest, ledgerPath: string): void {
  const ledger = Ledger.open(ledgerPath, { create: true });
  ledger.begin(manifest.bundle, manifest.ledgerGeneration);
  for (const s of manifest.steps) {
    if (s.step === 'sql') {
      for (const f of s.files) {
        const rows = readFileSync(
          join(outDir, f.replace(/^sql\//, 'ledger/').replace(/\.sql$/, '.jsonl')),
          'utf8',
        )
          .split('\n')
          .filter(Boolean)
          .map((l): LedgerRow => {
            const [t, k, v] = JSON.parse(l) as LedgerEntry;
            return [s.db, t, k, v];
          });
        ledger.markDone(manifest.bundle, f, rows);
      }
    } else if (s.step === 'rooms') {
      const lines = readFileSync(join(outDir, s.file), 'utf8').split('\n').filter(Boolean);
      ledger.markDone(
        manifest.bundle,
        'rooms',
        lines.map((l): LedgerRow => {
          const [app, id, v] = JSON.parse(l) as RoomLine;
          return ['rooms', app, id, v];
        }),
      );
    }
  }
  ledger.finish(manifest.bundle);
  ledger.close();
}

export const all = <T = Record<string, unknown>>(
  db: DatabaseSync,
  sql: string,
  ...args: (string | number | null)[]
) => db.prepare(sql).all(...args) as T[];
