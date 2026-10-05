import {
  CHANGESET_PART_MAX_BYTES,
  type ChangesetCounts,
  type ChangesetWritten,
  type ResultLine,
} from '@livediagram/api-schema';
import {
  diffToElementOps,
  elementFingerprint,
  invertElementOps,
  type Element,
  type ElementOp,
  type Tab,
} from '@livediagram/document';
import {
  insertChangesetPartStatement,
  insertChangesetStatement,
  isTabRevStale,
  revFromBatch,
  tabWriteStatements,
  type ChangesetFingerprints,
  type ChangesetRecord,
} from '../db';
import { TabTooLargeError } from '../limits';
import { relayChangeset } from '../room-client';
import type { Env } from '../types';
import { mintChangesetId } from './changeset-id';
import { agentKeyFor, changesetRoomOp } from './room-op';
import type { StoredTab } from './stored-tab';

// One changeset's write (docs/specs/024-agents/blueprints/agent-changesets.md "The pipeline" steps
// 7 to 10), shared by a submit and a revert: the tab at the revision it was read, the record and
// its three parts in ONE batch (the revision trigger aborts all of it when the tab moved), then the
// relay to the document's room, which never fails the write.

export type Author = { id: string; name: string; color: string };

export type ChangesetWrite = {
  documentId: string;
  tabId: string;
  // The tab as read; null when the changeset creates it.
  stored: StoredTab | null;
  next: Tab;
  orderIndex: number;
  author: Author;
  tokenId: string | null;
  summary: string | null;
  baseRev: number | null;
  rebasedOver: number;
  prevRev: number | null;
  results: ResultLine[];
  // The answer's text for the written changeset (its result lines and footer), stored in the
  // results part for `GET .../changesets/:id`.
  textFor: (written: ChangesetWritten) => string;
  revertOf: string | null;
};

export type WriteOutcome =
  | { kind: 'written'; written: ChangesetWritten; record: ChangesetRecord; text: string }
  | { kind: 'unchanged' }
  | { kind: 'stale' }
  | { kind: 'too_large' };

export async function writeChangeset(env: Env, w: ChangesetWrite): Promise<WriteOutcome> {
  const before = w.stored?.tab.elements ?? [];
  // What turns the stored elements into the next ones, so the record, the relay and the merge on
  // save all say exactly what landed (server rules included).
  const elementOps = diffToElementOps(before, w.next.elements);
  const creates = w.stored === null;
  if (elementOps.length === 0 && !creates) return { kind: 'unchanged' };
  const inverse = invertElementOps(before, elementOps);
  const expected = w.stored?.rev ?? 0;
  const rev = expected + 1;
  const now = Date.now();
  const writtenAs = (id: string): ChangesetWritten => ({
    id,
    tabId: w.tabId,
    rev,
    previousRev: expected,
    rebasedOver: w.rebasedOver,
  });
  const partsFor = (id: string) => ({
    ops: JSON.stringify(elementOps),
    inverse: JSON.stringify(inverse),
    results: JSON.stringify({ results: w.results, text: w.textFor(writtenAs(id)) }),
  });
  let record: ChangesetRecord = {
    id: mintChangesetId(),
    documentId: w.documentId,
    tabId: w.tabId,
    rev,
    baseRev: w.baseRev,
    authorId: w.author.id,
    authorName: w.author.name,
    authorColor: w.author.color,
    tokenId: w.tokenId,
    summary: w.summary,
    fingerprints: fingerprintsOf(before, w.next.elements, elementOps),
    counts: countsOf(elementOps),
    createdTab: creates,
    revertOf: w.revertOf,
    createdAt: now,
  };
  let parts = partsFor(record.id);
  if (Object.values(parts).some((p) => byteLength(p) > CHANGESET_PART_MAX_BYTES)) {
    return { kind: 'too_large' };
  }
  // One re-mint inside the attempt on an id collision (CS7, E21).
  for (let mint = 0; mint < 2; mint += 1) {
    try {
      const results = await env.DB.batch([
        ...tabWriteStatements(env, w.documentId, w.next, w.orderIndex, { expected }, now),
        insertChangesetStatement(env, record),
        insertChangesetPartStatement(env, record.id, 'ops', parts.ops),
        insertChangesetPartStatement(env, record.id, 'inverse', parts.inverse),
        insertChangesetPartStatement(env, record.id, 'results', parts.results),
      ]);
      record = { ...record, rev: revFromBatch(results) };
      break;
    } catch (err) {
      if (err instanceof TabTooLargeError) return { kind: 'too_large' };
      if (isTabRevStale(err) || isCreateRace(err, creates)) return { kind: 'stale' };
      if (mint === 0 && isIdCollision(err)) {
        record = { ...record, id: mintChangesetId() };
        parts = partsFor(record.id);
        continue;
      }
      throw err;
    }
  }
  await relayChangeset(
    env,
    w.documentId,
    changesetRoomOp({
      id: record.id,
      tabId: w.tabId,
      rev: record.rev,
      prevRev: w.prevRev,
      author: { name: w.author.name, color: w.author.color },
      summary: w.summary,
      counts: record.counts,
      elementOps,
      ...(w.tokenId ? { agentKey: await agentKeyFor(w.tokenId) } : {}),
      ...(creates ? { tab: tabFieldsOf(w.next) } : {}),
      revertOf: w.revertOf,
    }),
  );
  const written = writtenAs(record.id);
  return { kind: 'written', record, written, text: w.textFor(written) };
}

// Each touched element as found and as left; the order found when the changeset reordered (CS17).
export function fingerprintsOf(
  before: Element[],
  after: Element[],
  ops: readonly ElementOp[],
): ChangesetFingerprints {
  const beforeById = new Map(before.map((e) => [e.id, e] as const));
  const afterById = new Map(after.map((e) => [e.id, e] as const));
  const fps: ChangesetFingerprints = { before: {}, after: {} };
  for (const op of ops) {
    if (op.kind === 'reorder') {
      fps.beforeOrder = before.filter((e) => afterById.has(e.id)).map((e) => e.id);
      continue;
    }
    const id = op.kind === 'remove' ? op.id : op.element.id;
    const was = beforeById.get(id);
    const now = afterById.get(id);
    if (was) fps.before[id] = elementFingerprint(was);
    if (now) fps.after[id] = elementFingerprint(now);
  }
  return fps;
}

export function countsOf(ops: readonly ElementOp[]): ChangesetCounts {
  const counts = { added: 0, changed: 0, removed: 0 };
  for (const op of ops) {
    if (op.kind === 'add') counts.added += 1;
    else if (op.kind === 'update') counts.changed += 1;
    else if (op.kind === 'remove') counts.removed += 1;
  }
  return counts;
}

function tabFieldsOf(tab: Tab): Omit<Tab, 'elements'> {
  const { elements: _elements, ...fields } = tab;
  return fields;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

// A create that lost to another create of the same tab id: the tab or the link row now exists.
function isCreateRace(err: unknown, creates: boolean): boolean {
  return (
    creates &&
    err instanceof Error &&
    /UNIQUE constraint failed: (tabs|document_tabs)/.test(err.message)
  );
}

function isIdCollision(err: unknown): boolean {
  return err instanceof Error && err.message.includes('agent_changesets.id');
}
