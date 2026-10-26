// `migrate plan` (docs/migration.md "Tooling"): the whole migration as a bundle on disk, written once and read by
// apply and verify. Deterministic: the same snapshot, Clerk export, accounts list and ledger make the same bundle
// (every id is derived, every list ordered, and "now" is the snapshot's time).
//
//   <bundle>/manifest.json         the steps apply runs, in order, with their files; the bundle id and ledger
//                                  generation it was planned at
//   <bundle>/owner-map.json        every old owner and the id it has now
//   <bundle>/sql/<db>/NNNN.sql     accounts, index, media and community, in numbered chunks
//   <bundle>/ledger/<db>/NNNN.jsonl  the ledger rows each chunk writes, recorded once it has run
//   <bundle>/r2/images.json        the objects to put in the media bucket; r2/pictures/ the drawn pictures
//   <bundle>/rooms/<app>/<id>.json one MigrationRoomPayload per part; rooms/rooms.jsonl lists them in order
//   <bundle>/people/<app>/<id>.json  one MigrationPersonPayload per person with shape libraries; people/people.jsonl
//   <bundle>/kv/mcp-clients.json   the MCP's client registrations
//   <bundle>/moved-parts.json      where each split document's parts went
//   <bundle>/report.json           counts, matches, cross-product references, dropped history, collisions
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { sha256Hex } from '../ids.ts';
import { ImageOwners, makeHooks } from '../hooks.ts';
import { Ledger } from '../ledger.ts';
import { OwnerMap, readClerkUsers, readExistingAccounts } from '../owner-map.ts';
import type { PictureDrawer } from '../pictures.ts';
import { DBS, SqlWriter, type Db, type TableCounts } from '../sql.ts';
import {
  writeLegacyGuests,
  writeLifecycle,
  writeProfiles,
  writeSettings,
  writeTeams,
  writeTokens,
  writeUsers,
} from './accounts.ts';
import { writeCommunity } from './community.ts';
import { TABLE_ORDER, type PlanContext } from './context.ts';
import { documentPass, keptByPass, type SplitFn } from './documents.ts';
import { JsonArrayFile, PeopleFiles, RoomFiles } from './files.ts';
import { writeFolders, writePlacementDefaults } from './folders.ts';
import { readOauthKvDump } from './kv.ts';
import { writeImages } from './media.ts';
import { writeShapeLibraries } from './people.ts';
import { Report } from './report.ts';
import { writeTimeline } from './timeline.ts';

export const BUNDLE_FORMAT = 1;

export type ManifestStep =
  | { step: 'sql'; db: Db; files: string[] }
  | { step: 'r2'; file: string; count: number }
  | { step: 'rooms'; file: string; count: number }
  | { step: 'people'; file: string; count: number }
  | { step: 'kv'; file: string; count: number };

export type Manifest = {
  format: typeof BUNDLE_FORMAT;
  bundle: string;
  ledgerGeneration: number;
  snapshot: { exportSha256: string; level: string; snapshotAt: number };
  steps: ManifestStep[];
};

export type PlanInput = {
  snapshot: DatabaseSync;
  snapshotMeta: { exportSha256: string; level: string; snapshotAt: number };
  clerkCsv: string;
  existingAccounts: string;
  ledgerPath?: string | null;
  oauthKvPath?: string | null;
  outDir: string;
  /** Draws picture slots; null leaves them empty (reported). */
  drawPicture: PictureDrawer | null;
  /** The splitter; tests hand in a fake. */
  split?: SplitFn;
};

export type PlanResult = { manifest: Manifest; report: Report; ms: number };

export async function plan(input: PlanInput): Promise<PlanResult> {
  const started = performance.now();
  const { snapshot, outDir } = input;
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    throw new Error(`${outDir} is not empty: a bundle is written once, into a new folder`);
  }
  mkdirSync(outDir, { recursive: true });
  const ledger = Ledger.open(input.ledgerPath ?? null);
  try {
    const clerk = readClerkUsers(input.clerkCsv);
    const aliases = new Map<string, string>();
    for (const a of snapshot
      .prepare('SELECT owner_id, alias_id FROM owner_aliases ORDER BY created_at, alias_id')
      .all() as { owner_id: string; alias_id: string }[]) {
      if (!aliases.has(a.alias_id)) aliases.set(a.alias_id, a.owner_id);
    }
    const owners = new OwnerMap(clerk.users, readExistingAccounts(input.existingAccounts), aliases);
    const report = new Report();
    for (const s of clerk.skipped)
      report.skip('clerk_user', s, 'no usable email in the Clerk export');
    const sql = Object.fromEntries(
      DBS.map((db) => [db, new SqlWriter(db, outDir, ledger, TABLE_ORDER[db])]),
    ) as PlanContext['sql'];
    const ctx: PlanContext = {
      snapshot,
      owners,
      ledger,
      now: input.snapshotMeta.snapshotAt,
      bundleDir: outDir,
      sql,
      report,
      kept: new Map(),
      linkTargets: new Map(),
      guestFirstSeen: new Map(),
    };
    const images = new ImageOwners(snapshot, owners);
    const keptBy = keptByPass(ctx, makeHooks({ owners, images }), input.split);
    const hooks = makeHooks({ owners, images, keptBy });

    writeUsers(ctx);
    writeTeams(ctx);
    writeTokens(ctx);
    writeSettings(ctx);
    writeLifecycle(ctx);

    const rooms = new RoomFiles(outDir, ledger);
    const people = new PeopleFiles(outDir, ledger);
    writeShapeLibraries(ctx, people);
    const r2 = new JsonArrayFile(join(outDir, 'r2', 'images.json'));
    const moved = new JsonArrayFile(join(outDir, 'moved-parts.json'));
    const folders = writeFolders(ctx);
    // Old images first, so a picture drawn for an owner whose old image has the same bytes is the one dropped.
    writeImages(ctx, r2);
    await documentPass(ctx, {
      hooks,
      split: input.split,
      drawPicture: input.drawPicture,
      folders,
      rooms,
      r2,
      moved,
    });
    writePlacementDefaults(ctx, folders);
    writeTimeline(ctx);
    writeCommunity(ctx);
    // Last: every pass has named its guests by now.
    writeProfiles(ctx);
    writeLegacyGuests(ctx);
    rooms.close();
    people.close();
    r2.close();
    moved.close();

    const kv = input.oauthKvPath ? readOauthKvDump(input.oauthKvPath, ctx.now, report) : [];
    const kvFresh = kv.filter(
      (p) => ledger.version('kv', 'clients', p.key) !== JSON.stringify(sha256Hex(p.value)),
    );
    mkdirSync(join(outDir, 'kv'), { recursive: true });
    writeFileSync(join(outDir, 'kv', 'mcp-clients.json'), `${JSON.stringify(kvFresh, null, 2)}\n`);

    const files = Object.fromEntries(DBS.map((db) => [db, sql[db].close()])) as Record<
      Db,
      string[]
    >;
    report.add('rooms.written', rooms.written);
    report.add('rooms.unchanged', rooms.unchanged);
    report.add('people.written', people.written);
    report.add('people.unchanged', people.unchanged);
    report.add('r2.objects', r2.count);
    report.add('movedParts', moved.count);

    const generation = ledger.generation();
    const manifest: Manifest = {
      format: BUNDLE_FORMAT,
      bundle: sha256Hex(`${input.snapshotMeta.exportSha256}:${generation}:${BUNDLE_FORMAT}`).slice(
        0,
        16,
      ),
      ledgerGeneration: generation,
      snapshot: input.snapshotMeta,
      steps: [
        { step: 'sql', db: 'accounts', files: files.accounts },
        { step: 'sql', db: 'index', files: files.index },
        { step: 'sql', db: 'media', files: files.media },
        { step: 'r2', file: 'r2/images.json', count: r2.count },
        { step: 'rooms', file: 'rooms/rooms.jsonl', count: rooms.written },
        { step: 'people', file: 'people/people.jsonl', count: people.written },
        { step: 'sql', db: 'community', files: files.community },
        { step: 'kv', file: 'kv/mcp-clients.json', count: kvFresh.length },
      ],
    };
    const tables: Record<string, Record<string, TableCounts>> = {};
    for (const db of DBS) {
      tables[db] = Object.fromEntries(
        [...sql[db].counts.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
      );
    }
    writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(outDir, 'owner-map.json'), `${JSON.stringify(owners, null, 2)}\n`);
    writeFileSync(
      join(outDir, 'report.json'),
      `${JSON.stringify(
        {
          bundle: manifest.bundle,
          tables,
          ...report.toJSON(),
          ownerMap: {
            matches: owners.matches.length,
            guests: owners.guests.size,
            unknownAccounts: [...owners.unknownAccounts].sort(),
            invalidGuests: [...owners.invalidGuests].sort(),
          },
        },
        null,
        2,
      )}\n`,
    );
    return { manifest, report, ms: performance.now() - started };
  } finally {
    ledger.close();
  }
}
