// A restore (docs/specs/006-document/version-history.md "Restore"; blueprint VH5, VH15): the version's content written
// as one changeset by the restorer, at the revision read, with the content it replaces kept first as a `restore`
// version (its id is the Undo). What the elements do not carry rides the same write and reaches the room as the
// `tab-meta` and `article` ops an agent's page change sends. A lost race reads again; an agent's restore is held by
// people's selections like any agent changeset.

import { diffToElementOps, type ElementOp, type Tab } from '@liveknowledge/document';
import { restoreSummary, type VersionRestoreResponse } from '@liveknowledge/api-schema';
import {
  copyTabStatement,
  isTabRevStale,
  lastChangesetRev,
  upsertTabAtRev,
  versionAtRev,
  versionId,
  type StoredVersion,
} from '../db';
import { TabTooLargeError } from '../limits';
import { personTagFor } from '../person-tag';
import { readRoomSelections, relayPages } from '../room-client';
import type { DocumentDTO, DocumentEnv } from '../types';
import type { HeldElement } from '@liveknowledge/api-schema';
import { heldTargets } from '../changesets/held-check';
import { readStoredTab, type StoredTab } from '../changesets/stored-tab';
import { SUBMIT_ATTEMPTS } from '../changesets/submit';
import { writeChangeset, type Author } from '../changesets/write';
import {
  personWho,
  queueVersionEvent,
  type VersionWho,
} from '../document-room/automations/version-events';
import { parseVersionBody, restoredTab, restoreRoomOps, sameContent } from './restore-tab';
import { noteWatched } from '../knowledge/watch-notes';

export type RestoreResult =
  | { status: 200; body: VersionRestoreResponse }
  | { status: 404; body: { error: 'not_found'; message: string } }
  | { status: 409; body: { error: 'elements_held'; held: HeldElement[] } }
  | { status: 409; body: { error: 'tab_busy'; message: string } }
  | { status: 413; body: { error: 'tab_too_large'; message: string } };

type RestoreArgs = {
  env: DocumentEnv;
  document: DocumentDTO;
  tabId: string;
  version: StoredVersion;
  author: Author;
  tokenId: string | null;
  tokenName?: string | null;
  // Who the document's rules hear restored it: a rule's own step names itself; by default the author (an agent by
  // its token's name).
  who?: VersionWho;
};

const notFound = (message: string): RestoreResult => ({
  status: 404,
  body: { error: 'not_found', message },
});

export async function restoreVersion(args: RestoreArgs): Promise<RestoreResult> {
  const { env, document, tabId, version } = args;
  const where = { documentId: document.id, tabId, versionId: version.summary.id };
  const body = parseVersionBody(version.data);
  if (!body) {
    console.warn('[versions] refused', { ...where, reason: 'unreadable' });
    return notFound('That version can no longer be read.');
  }
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
    const [stored, prevRev] = await Promise.all([
      readStoredTab(env, document.id, tabId),
      lastChangesetRev(env, tabId),
    ]);
    if (!stored) return notFound('No such tab.');
    const next = restoredTab(stored.tab, body);
    if (sameContent(stored.tab, next)) {
      console.info('[versions] restored', { ...where, unchanged: true });
      return { status: 200, body: { restored: null } };
    }
    const elementOps = diffToElementOps(stored.tab.elements, next.elements);
    if (args.tokenId) {
      const held = await heldBy(args, elementOps);
      if (held.length > 0) {
        console.info('[versions] refused', { ...where, reason: 'held', held: held.length });
        return { status: 409, body: { error: 'elements_held', held } };
      }
    }
    // The content it replaces, kept first so the restore can be undone: the version already holding this revision,
    // or a new `restore` one written in the restore's own batch.
    const existing = await versionAtRev(env, tabId, stored.rev);
    const undoVersionId = existing?.id ?? versionId();
    const keep = existing
      ? []
      : [
          copyTabStatement(env, {
            id: undoVersionId,
            tabId,
            rev: stored.rev,
            kind: 'restore',
            name: null,
            author: args.author,
            now: Date.now(),
          }),
        ];
    const written = await write(args, stored, next, prevRev, elementOps.length > 0, keep);
    if (written === 'stale') {
      console.warn('[versions] restore-retry', { ...where, attempt });
      continue;
    }
    if (written === 'too_large') {
      return {
        status: 413,
        body: { error: 'tab_too_large', message: 'That version no longer fits a tab.' },
      };
    }
    // Version Restored, for the document's rules (docs/specs/013-workspace/automations.md).
    queueVersionEvent(env, 'restored', {
      tab: tabId,
      version: version.summary.id,
      name: version.summary.name,
      who: args.who ?? personWho(args.author, args.tokenId ? { name: args.tokenName } : null),
    });
    // The page's watchers hear of it as a save (watching.md "Edited"); never throws.
    await noteWatched(env, {
      tabs: [tabId],
      kind: 'saved',
      actor: () => ({ id: args.author.id, name: args.tokenId ? args.tokenName || 'An agent' : args.author.name }),
    });
    // Awaited, bounded per op; a room that misses one is logged and never fails the restore.
    await relayPages(env, document.id, restoreRoomOps(stored.tab, next), '[versions]');
    console.info('[versions] restored', {
      ...where,
      rev: written.rev,
      changesetId: written.changesetId,
      elementOps: elementOps.length,
    });
    return {
      status: 200,
      body: {
        restored: { tabId, rev: written.rev, changesetId: written.changesetId, undoVersionId },
      },
    };
  }
  console.warn('[versions] refused', { ...where, reason: 'busy' });
  return {
    status: 409,
    body: { error: 'tab_busy', message: 'The tab kept changing; try again.' },
  };
}

// The elements a person holds that the restore would change: an agent's restore waits for them (spec "Held elements").
async function heldBy(args: RestoreArgs, ops: readonly ElementOp[]): Promise<HeldElement[]> {
  const tag = await personTagFor(args.document.id, args.author.id);
  const selections = await readRoomSelections(args.env, args.document.id, args.tabId, tag);
  const touched = ops.flatMap((op) =>
    op.kind === 'remove' ? [op.id] : op.kind === 'reorder' ? [] : [op.element.id],
  );
  return heldTargets(touched, selections);
}

type Written = { rev: number; changesetId: string | null } | 'stale' | 'too_large';

// With element changes, one changeset (recorded, merged into saves that had not seen it, relayed); with none (only
// the pages or the look differ), the keep and then the tab at the revision read.
async function write(
  args: RestoreArgs,
  stored: StoredTab,
  next: Tab,
  prevRev: number | null,
  elementsChanged: boolean,
  keep: D1PreparedStatement[],
): Promise<Written> {
  const { env, document, tabId } = args;
  if (elementsChanged) {
    const outcome = await writeChangeset(env, {
      documentId: document.id,
      tabId,
      stored,
      next,
      orderIndex: stored.orderIndex,
      author: args.author,
      tokenId: args.tokenId,
      tokenName: args.tokenName ?? null,
      summary: restoreSummary(args.version.summary.name),
      baseRev: stored.rev,
      rebasedOver: 0,
      prevRev,
      results: [],
      textFor: () => restoreSummary(args.version.summary.name),
      revertOf: null,
      preStatements: keep,
    });
    if (outcome.kind === 'stale') return 'stale';
    if (outcome.kind === 'too_large') return 'too_large';
    return outcome.kind === 'written'
      ? { rev: outcome.written.rev, changesetId: outcome.written.id }
      : { rev: stored.rev, changesetId: null };
  }
  try {
    for (const statement of keep) await statement.run();
    const rev = await upsertTabAtRev(env, document.id, next, stored.orderIndex, stored.rev);
    return { rev, changesetId: null };
  } catch (err) {
    if (err instanceof TabTooLargeError) return 'too_large';
    if (isTabRevStale(err)) return 'stale';
    throw err;
  }
}
