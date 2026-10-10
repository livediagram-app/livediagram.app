// The local sync state (docs/specs/027-repositories/repository-link.md "Local sync state"; blueprint "Data and
// persistence"): per link and work tree, never committed. Inside a git work tree at `<git dir>/livediagram/<link id>/`
// (each worktree its own), elsewhere at `<cache>/links/<link id>/`; directories 0700, files 0600 (RL8). It holds
// what each document was at its last sync here (RL44), the lock, and the latest reports.

import { posix } from 'node:path';
import { cacheDir } from '../config/paths';
import type { CliIo } from '../io';
import { LINK_ID_HEX, SYNC_REPORTS_KEPT } from './constants';
import { gitDirOf } from './git';
import type { LinkFile } from './link-file';
import type { RecordedDocument } from './recorded-state';
import { isRecord } from '@livediagram/document';
import { sha256Hex } from '@livediagram/api-schema';

export type LinkState = {
  version: 1;
  linkPath: string;
  documents: Record<string, RecordedDocument>;
};

export type SyncReport = {
  startedAt: number;
  finishedAt: number;
  command: string;
  lines: string[];
  exit: number;
};

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export async function linkIdOf(realPath: string): Promise<string> {
  return (await sha256Hex(new TextEncoder().encode(realPath))).slice(0, LINK_ID_HEX);
}

export async function linkStateDir(io: CliIo, link: LinkFile): Promise<string> {
  const id = await linkIdOf(link.path);
  const gitDir = await gitDirOf(io, link.root);
  return gitDir ? posix.join(gitDir, 'livediagram', id) : `${cacheDir(io)}/links/${id}`;
}

// A missing, unreadable or other-version state starts empty, and is rewritten by the next pass.
export async function readLinkState(io: CliIo, dir: string, linkPath: string): Promise<LinkState> {
  const empty: LinkState = { version: 1, linkPath, documents: {} };
  const text = await io.files.read(posix.join(dir, 'state.json'));
  try {
    const state: unknown = text === null ? null : JSON.parse(text);
    if (isRecord(state) && state.version === 1 && isRecord(state.documents))
      return { version: 1, linkPath, documents: state.documents as LinkState['documents'] };
  } catch {
    // Unreadable: start over.
  }
  return empty;
}

// The local sync state directory, private to this account: made 0700, and narrowed to 0700 when an earlier version
// left it wider. Called before anything is created inside it (the lock first).
export async function prepareLinkStateDir(io: CliIo, dir: string): Promise<void> {
  await io.files.mkdir(dir, DIR_MODE);
  const mode = await io.files.mode(dir);
  if (mode !== null && mode !== DIR_MODE) await io.files.chmod(dir, DIR_MODE);
}

export async function writeLinkState(io: CliIo, dir: string, state: LinkState): Promise<void> {
  await io.files.mkdir(dir, DIR_MODE);
  await io.files.write(posix.join(dir, 'state.json'), JSON.stringify(state), FILE_MODE);
}

// `reports/<startedAt>-<pid>.json`; the newest SYNC_REPORTS_KEPT are kept.
export async function saveReport(io: CliIo, dir: string, report: SyncReport): Promise<void> {
  const reports = posix.join(dir, 'reports');
  await io.files.mkdir(reports, DIR_MODE);
  await io.files.write(
    posix.join(reports, `${report.startedAt}-${io.pid}.json`),
    JSON.stringify({ version: 1, ...report }),
    FILE_MODE,
  );
  const names = (await io.files.list(reports))!.map((e) => e.name).sort();
  for (const name of names.slice(0, Math.max(0, names.length - SYNC_REPORTS_KEPT)))
    await io.files.remove(posix.join(reports, name));
}
