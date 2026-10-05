// PUT /api/documents/<id>/tabs/<tabId>: the editor's whole-tab autosave and nothing else's
// (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames"; blueprint "The tab
// PUT"). A token is refused; the save is merged with every recorded changeset its editor had not
// seen and with the room's collaboration ledger, then written at the revision it read.

import {
  CHANGESET_MERGE_WINDOW_MS,
  CHANGESET_SEEN_HEADER,
  TAB_SAVE_CAS_ATTEMPTS,
  parseChangesetSeen,
} from '@livediagram/api-schema';
import { isValidTab, migrateIncomingTab, preferNewerQaAll, type Tab } from '@livediagram/document';
import { mergeChangesetsIntoSave } from '../changesets/merge-on-save';
import { hasNewComments, rewriteCommentAuthors } from '../comments';
import {
  changesetMergePages,
  getParticipant,
  getTab,
  isTabRevStale,
  upsertTabAtRev,
  tabBelongsElsewhere,
} from '../db';
import { emailEnabled } from '../email/client';
import { notifyNewComment } from '../email/notifications';
import { MAX_TAB_BYTES, bodyExceedsCap, storeTab } from '../limits';
import { capStoredName } from '../names';
import { badRequest, conflict, json, payloadTooLarge } from '../responses';
import { mergeRoomLedger } from '../room-client';
import { recordTabSave } from '../timeline';
import type { DocumentDTO } from '../types';
import type { RouteContext } from './context';

// Fields of the stored record, not of the tab body; a client echoing them back never stores them
// (CS32).
const RECORD_FIELDS = ['rev', 'documentId', 'orderIndex', 'updatedAt'] as const;

// A token never does a whole-tab save (CS45): answered before anything is read.
export function refuseTokenTabPut(
  ctx: RouteContext,
  documentId: string,
  tabId: string,
): Response | null {
  if (!ctx.token) return null;
  console.info('[changeset] whole-tab-refused', { documentId, tabId, tokenId: ctx.token.id });
  return json(
    {
      error: 'use_changesets',
      message: `Agents and scripts write tabs with changesets: POST /api/documents/${documentId}/tabs/${tabId}/changesets`,
    },
    { status: 405 },
  );
}

// The caller has passed the edit gate for this tab.
export async function handleTabPut(
  ctx: RouteContext,
  existing: DocumentDTO,
  tabId: string,
  owner: string,
): Promise<Response> {
  const { request, env } = ctx;
  const id = existing.id;
  // A former stored shape (freehand points before docs/specs/006-document/stroke-points.md,
  // from a browser loaded before a deploy) is migrated, not refused.
  const received = migrateIncomingTab(await request.json()) as Tab;
  // Structural schema gate (shared with the app, @livediagram/document): discriminant, required
  // fields, endpoints, array bounds + unique ids.
  if (!isValidTab(received)) return badRequest('invalid tab');
  // Byte cap on the single tab (the body cap bounds the whole request; this bounds one tab's
  // element + comment tree). See bodyExceedsCap for why the header alone isn't enough.
  if (bodyExceedsCap(request, received, MAX_TAB_BYTES)) return payloadTooLarge();
  const incoming = withoutRecordFields({ ...received, id: tabId });
  const seenHeader = request.headers.get(CHANGESET_SEEN_HEADER);
  const seen = parseChangesetSeen(seenHeader);
  if (seenHeader !== null && seen === null) {
    console.warn('[changeset] seen-invalid', { documentId: id, tabId, length: seenHeader.length });
  }

  for (let attempt = 1; attempt <= TAB_SAVE_CAS_ATTEMPTS; attempt += 1) {
    // The stored tab and the changesets this editor had not seen, read together. Changesets merge
    // first, so their before-image compare sees the save as sent; then the room's ledger.
    const [existingTab, merge] = await Promise.all([
      getTab(env, id, tabId),
      mergeUnseenChangesets(ctx, incoming, seen),
    ]);
    // A new tab id must be new: an id that already names another document's tab is refused, never overwritten
    // (docs/specs/006-document/per-tab-storage.md). Checked only when this document has no such tab, so the
    // common autosave pays nothing.
    if (!existingTab && (await tabBelongsElsewhere(env, tabId, id))) {
      console.warn("[tabs] refused a save onto another document's tab", { documentId: id, tabId });
      return conflict('tab_id_taken');
    }
    const ledger = await mergeRoomLedger(env, id, merge.tab, request.headers.get('X-Room-Cursor'));
    const commentAuthors = ledger.commentAuthors;
    // A copy: each attempt starts again from the save as sent.
    const body: Tab = { ...ledger.tab };
    // The name cap (docs/specs/006-document/name-length.md): a new or changed name is shortened;
    // an autosave echoing the stored name unchanged keeps it.
    body.name = capStoredName(body.name, existingTab?.name ?? null, 'tab');
    // Data-loss backstop (docs/specs/006-document/per-tab-storage.md): refuse to blank a tab that
    // holds content unless the editor marks the empty write intentional (`X-Allow-Empty: 1`, set
    // only when it had the tab's content authoritatively loaded).
    if (
      body.elements.length === 0 &&
      existingTab &&
      existingTab.elements.length > 0 &&
      request.headers.get('X-Allow-Empty') !== '1'
    ) {
      return conflict('empty_tab_overwrite_blocked');
    }
    // A Q&A board's notes are owned by the qa endpoint (docs/specs/012-collaboration/qa-board.md):
    // keep whichever copy has the higher `qaRev`.
    if (existingTab) body.elements = preferNewerQaAll(existingTab.elements, body.elements);
    const orderIndex = existingTab?.orderIndex ?? existing.tabs.length;
    // Newly added comments carry the resolved owner's participant record, never the client's claim
    // (docs/specs/014-identity/auth-and-guest-access.md). getDocument already joined the owner's
    // row: reused when the writer IS the owner, the common autosave case.
    const writerParticipant =
      owner === existing.ownerId && existing.ownerName !== null
        ? {
            id: owner,
            name: existing.ownerName,
            color: existing.ownerColor ?? '#0ea5e9',
            createdAt: existing.createdAt,
            pictureUrl: null,
          }
        : await getParticipant(env, owner);
    const sanitised: Tab = writerParticipant
      ? {
          ...body,
          elements: rewriteCommentAuthors(
            body.elements,
            existingTab?.elements ?? [],
            writerParticipant,
            commentAuthors,
          ),
        }
      : body;
    let rev = 0;
    try {
      // The merged tab may outgrow the request: the storage layer measures what it stores
      // (docs/specs/015-api/api.md "Tab size").
      const written = await storeTab(async () => {
        rev = await upsertTabAtRev(env, id, sanitised, orderIndex, existingTab?.rev ?? 0);
      });
      if (!written) return payloadTooLarge();
    } catch (err) {
      if (!isTabRevStale(err)) throw err;
      console.warn('[changeset] lost-race', { documentId: id, tabId, attempt, write: 'save' });
      continue;
    }
    logMerge(id, tabId, merge);
    // docs/specs/013-workspace/timeline.md: the coalesced "worked on" event plus anything the save
    // added that the feed cares about. Off the response path: this fires on every autosave.
    ctx.waitUntil?.(
      recordTabSave(env, existing, owner, sanitised.elements, existingTab?.elements ?? []),
    );
    // docs/specs/014-identity/transactional-email.md (#1): an edit-role visitor adding a comment
    // notifies the owner.
    if (
      emailEnabled(env) &&
      owner !== existing.ownerId &&
      hasNewComments(body.elements, existingTab?.elements ?? [])
    ) {
      ctx.waitUntil?.(
        notifyNewComment(
          env,
          { id, ownerId: existing.ownerId, name: existing.name },
          writerParticipant?.name ?? null,
        ),
      );
    }
    // Echo what was just written instead of reading it back; folder is link metadata the client
    // strips before persisting, so it is absent by design.
    return json({
      tab: {
        ...sanitised,
        id: tabId,
        name: body.name,
        documentId: id,
        orderIndex,
        updatedAt: Date.now(),
        rev,
      },
    });
  }
  return conflict('tab_busy');
}

type MergeOutcome = { tab: Tab; records: number; merged: number; superseded: number };

// Every recorded changeset of this tab after the revision the editor has seen, or, from an editor
// too old to say (no header), those of the last CHANGESET_MERGE_WINDOW_MS, page by page.
async function mergeUnseenChangesets(
  ctx: RouteContext,
  save: Tab,
  seen: number | null,
): Promise<MergeOutcome> {
  const after =
    seen === null ? { since: Date.now() - CHANGESET_MERGE_WINDOW_MS } : { afterRev: seen };
  let outcome: MergeOutcome = { tab: save, records: 0, merged: 0, superseded: 0 };
  for await (const page of changesetMergePages(ctx.env, save.id, after)) {
    const step = mergeChangesetsIntoSave(outcome.tab, page);
    outcome = {
      tab: step.tab,
      records: outcome.records + page.length,
      merged: outcome.merged + step.merged,
      superseded: outcome.superseded + step.superseded,
    };
  }
  return outcome;
}

function logMerge(documentId: string, tabId: string, merge: MergeOutcome): void {
  if (merge.merged > 0) {
    console.info('[changeset] merged-on-save', {
      documentId,
      tabId,
      records: merge.records,
      elements: merge.merged,
    });
  }
  if (merge.superseded > 0) {
    console.info('[changeset] superseded-on-save', {
      documentId,
      tabId,
      elements: merge.superseded,
    });
  }
}

function withoutRecordFields(tab: Tab): Tab {
  const copy = { ...tab } as Tab & Partial<Record<(typeof RECORD_FIELDS)[number], unknown>>;
  for (const field of RECORD_FIELDS) delete copy[field];
  return copy;
}
