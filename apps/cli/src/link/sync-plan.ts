// Planning a pass (docs/specs/027-repositories/blueprints/repository-link.md "Actions"): the scan, the coverage, what
// the api answered and what the local sync state recorded, to one action per document and per refused or reported
// file, documents in index order (RL41), then the files that name no readable document, by path. Pure. A document
// with no answer this pass (a pass narrowed to another) gets no action.

import type { OverviewView } from '@livediagram/api-schema';
import type { Coverage } from './coverage';
import { isCovered } from './coverage';
import type { MirrorLevel } from './link-file';
import type { MirrorFile } from './mirror-file';
import { mirrorPathFor } from './mirror-paths';
import type { ScannedFile, TabHashes } from './mirror-scan';
import { recordedStateOf, type RecordedDocument } from './recorded-state';
import { remoteTabsOf, type RemoteFact } from './remote';
import { isLocallyChanged, syncStateOf, type SyncState } from './sync-state';

export type RefuseReason =
  | 'ahead'
  | 'diverged'
  | 'gone-changed'
  | 'lowered-changed'
  | 'conflicted'
  | 'invalid'
  | 'foreign-host'
  | 'duplicate';

// A tab as a write line names it: its revision before (null: new) and now.
export type TabMove = { id: string; name: string; from: number | null; to: number };

type Doc = { documentId: string; name: string };
export type SyncAction =
  | (Doc & { kind: 'none'; path: string | null })
  | (Doc & {
      kind: 'write';
      reason: 'new' | 'behind';
      // Relative to the mirror directory; null at `index` and `none`.
      path: string | null;
      tabs: TabMove[];
    })
  | (Doc & { kind: 'remove'; path: string | null; reason: 'trashed' | 'outside' })
  | (Doc & { kind: 'lower'; path: string })
  | (Doc & { kind: 'transient'; failure: string; exit: 6 | 7; reason: string })
  | (Doc & { kind: 'relocate'; path: string; to: string })
  | {
      kind: 'refuse';
      documentId: string | null;
      path: string;
      reason: RefuseReason;
      // The parse failure, the other host, or the other file.
      detail: string | null;
    }
  // An unreadable document with no file has no path.
  | {
      kind: 'report';
      reason: 'unreadable' | 'local-new';
      documentId: string | null;
      path: string | null;
    };

export type PlanInput = {
  level: MirrorLevel;
  scan: readonly ScannedFile[];
  coverage: Coverage;
  remote: ReadonlyMap<string, RemoteFact>;
  recorded: Readonly<Record<string, RecordedDocument>>;
  // A narrowed pass: these documents and these files only.
  scope: { documents: ReadonlySet<string>; paths: ReadonlySet<string> } | null;
};

// Each decided document's state and name, in index order.
export type Plan = {
  actions: SyncAction[];
  states: Map<string, SyncState | 'transient'>;
  names: Map<string, string>;
};

type Tracked = Extract<ScannedFile, { class: 'tracked' }>;

// The remote tabs against what was recorded: every tab, with its revision before when it had one.
function tabMoves(overview: OverviewView, before: Record<string, number>): TabMove[] {
  return remoteTabsOf(overview).map((t) => ({
    id: t.tab.id,
    name: t.tab.name,
    from: before[t.tab.id] ?? null,
    to: t.rev!,
  }));
}

const revsOf = (file: MirrorFile) =>
  Object.fromEntries(Object.entries(file.livediagramSync.tabs).map(([id, t]) => [id, t.rev]));

// The index order (RL41): folder path, then name, then id, in code units.
function indexOrder(keyOf: (id: string) => { path: readonly string[]; name: string }) {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return (a: string, b: string) => {
    const [x, y] = [keyOf(a), keyOf(b)];
    for (let i = 0; i < Math.min(x.path.length, y.path.length); i++) {
      const c = cmp(x.path[i]!, y.path[i]!);
      if (c !== 0) return c;
    }
    return x.path.length - y.path.length || cmp(x.name, y.name) || cmp(a, b);
  };
}

export function planSync(input: PlanInput): Plan {
  const { level, scan, coverage, remote, recorded, scope } = input;
  const states = new Map<string, SyncState | 'transient'>();
  const names = new Map<string, string>();
  const inScope = (documentId: string | null, path: string | null) =>
    scope === null ||
    (documentId !== null && scope.documents.has(documentId)) ||
    (path !== null && scope.paths.has(path));
  const tracked = scan.filter((s): s is Tracked => s.class === 'tracked');
  const taken = new Set(scan.map((s) => s.path));
  const fileOf = new Map(level === 'files' ? tracked.map((t) => [t.file.document.id, t]) : []);
  // A document a duplicate file names is never written again beside them (RL11).
  const named = new Set(scan.flatMap((s) => (s.class === 'duplicate' ? [s.documentId] : [])));

  // A document's name: as the api answered it, else as its file, its coverage or its record knows it.
  const nameOf = (id: string) => {
    const fact = remote.get(id);
    if (fact?.kind === 'readable') return fact.overview.document.name;
    return (
      fileOf.get(id)?.file.document.name ??
      coverage.documents.find((d) => d.id === id)?.name ??
      recorded[id]?.name ??
      id
    );
  };
  const keyOf = (id: string) => ({
    path: coverage.documents.find((d) => d.id === id)?.folderPath ?? [],
    name: nameOf(id),
  });

  const ids = new Set([
    ...coverage.documents.map((d) => d.id),
    ...(level === 'files' ? fileOf.keys() : Object.keys(recorded)),
  ]);
  const ordered = [...ids]
    .filter((id) => remote.has(id) && inScope(id, fileOf.get(id)?.path ?? null))
    .sort(indexOrder(keyOf));

  const documentActions: SyncAction[] = [];
  for (const documentId of ordered) {
    const fact = remote.get(documentId)!;
    const covered = isCovered(coverage, documentId);
    const file = fileOf.get(documentId);
    const name = nameOf(documentId);
    const doc = { documentId, name };
    const state = file
      ? syncStateOf({ file: file.file, hashes: file.hashes, remote: fact, covered }).state
      : level === 'files'
        ? recordedStateOf({ remote: fact, covered, recorded: undefined })
        : recordedStateOf({ remote: fact, covered, recorded: recorded[documentId] });
    states.set(documentId, state);
    names.set(documentId, name);
    const path = file?.path ?? null;
    if (state === 'transient') {
      const { failure, exit, reason } = fact as Extract<RemoteFact, { kind: 'transient' }>;
      documentActions.push({ kind: 'transient', ...doc, failure, exit, reason });
      continue;
    }
    if (state === 'unreadable') {
      documentActions.push({
        kind: 'report',
        reason: 'unreadable',
        documentId,
        path,
      });
      continue;
    }
    if (state === 'gone') {
      const reason = fact.kind === 'trashed' ? 'trashed' : 'outside';
      if (file && isLocallyChanged(file.file, file.hashes))
        documentActions.push({
          kind: 'refuse',
          documentId,
          path: file.path,
          reason: 'gone-changed',
          detail: null,
        });
      else if (file || recorded[documentId])
        documentActions.push({ kind: 'remove', ...doc, path, reason });
      continue;
    }
    if (state === 'ahead' || state === 'diverged') {
      documentActions.push({
        kind: 'refuse',
        documentId,
        path: path!,
        reason: state,
        detail: null,
      });
      continue;
    }
    const covering = coverage.documents.find((d) => d.id === documentId);
    const folderPath = covering?.folderPath ?? [];
    if (level === 'files' && file) {
      taken.delete(file.path);
      const expected = mirrorPathFor({ id: documentId, name }, folderPath, taken);
      taken.add(file.path);
      if (expected !== file.path)
        documentActions.push({ kind: 'relocate', ...doc, path: file.path, to: expected });
    }
    if (state === 'in-step') {
      documentActions.push({ kind: 'none', ...doc, path });
      continue;
    }
    if (level === 'files' && !file && named.has(documentId)) continue;
    const before = file
      ? revsOf(file.file)
      : Object.fromEntries(
          Object.entries(recorded[documentId]?.tabs ?? {}).map(([id, t]) => [id, t.rev]),
        );
    let target: string | null = path;
    if (level === 'files' && !file) {
      target = mirrorPathFor({ id: documentId, name }, folderPath, taken);
      taken.add(target);
    }
    documentActions.push({
      kind: 'write',
      ...doc,
      reason: state === 'new' ? 'new' : 'behind',
      path: target,
      tabs: tabMoves((fact as Extract<RemoteFact, { kind: 'readable' }>).overview, before),
    });
  }

  const fileActions: SyncAction[] = [];
  for (const s of scan) {
    if (!inScope(s.class === 'tracked' ? s.file.document.id : null, s.path)) continue;
    if (s.class === 'tracked') {
      if (level === 'files') continue;
      const { id, name } = s.file.document;
      fileActions.push(
        isLocallyChanged(s.file, s.hashes)
          ? {
              kind: 'refuse',
              documentId: id,
              path: s.path,
              reason: 'lowered-changed',
              detail: level,
            }
          : { kind: 'lower', documentId: id, name, path: s.path },
      );
    } else if (s.class === 'local-new')
      fileActions.push({ kind: 'report', reason: 'local-new', documentId: null, path: s.path });
    else
      fileActions.push({
        kind: 'refuse',
        documentId: s.class === 'duplicate' ? s.documentId : null,
        path: s.path,
        reason: s.class,
        detail:
          s.class === 'invalid'
            ? s.message
            : s.class === 'foreign-host'
              ? s.host
              : s.class === 'duplicate'
                ? s.other
                : null,
      });
  }
  return { actions: [...documentActions, ...fileActions], states, names };
}

export type { TabHashes };
