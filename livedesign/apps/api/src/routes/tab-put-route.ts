// PUT /api/designs/<id>/tabs/<tabId>: the editor's whole-tab autosave and nothing else's
// (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames"; blueprint "The tab
// PUT"). A token is refused; the save is merged with every recorded changeset its editor had not
// seen and with the room's collaboration ledger, then written at the revision it read.

import {
  CHANGESET_MERGE_WINDOW_MS,
  CHANGESET_SEEN_HEADER,
  TAB_SAVE_CAS_ATTEMPTS,
  parseChangesetSeen,
} from '@livedesign/api-schema';
import { isValidTab, migrateIncomingTab, type Tab } from '@livedesign/design';
import { mergeChangesetsIntoSave } from '../changesets/merge-on-save';
import { newCommentsBy, rewriteCommentAuthors } from '../comments';
import { changesetMergePages, getTab, isTabRevStale, upsertTabAtRev } from '../db';
import { getParticipant } from '../accounts/profiles';
import { emailEnabled } from '../email/client';
import { notifyMentions, notifyNewComment } from '../email/notifications';
import { MAX_TAB_BYTES, bodyExceedsCap, storeTab } from '../limits';
import { capStoredName } from '../names';
import { badRequest, conflict, json, payloadTooLarge } from '../responses';
import { applyRoomLedger, fetchRoomLedger } from '../room-client';
import type { TabSaveDesign } from '../db/tab-save-design';
import { grantOn, readBody, type DesignRouteContext } from './context';

// Fields of the stored record, not of the tab body; a client echoing them back never stores them
// (CS32).
const RECORD_FIELDS = ['rev', 'designId', 'orderIndex', 'updatedAt'] as const;

// A token never does a whole-tab save (CS45): answered before anything is read.
export function refuseTokenTabPut(
  ctx: DesignRouteContext,
  designId: string,
  tabId: string,
): Response | null {
  if (!ctx.token) return null;
  console.info('[changeset] whole-tab-refused', { designId, tabId, tokenId: ctx.token.id });
  return json(
    {
      error: 'use_changesets',
      message: `Agents and scripts write tabs with changesets: POST /api/designs/${designId}/tabs/${tabId}/changesets`,
    },
    { status: 405 },
  );
}

// The caller has passed the edit gate for this tab.
export async function handleTabPut(
  ctx: DesignRouteContext,
  existing: TabSaveDesign,
  tabId: string,
  owner: string,
): Promise<Response> {
  const { request, env } = ctx;
  const id = existing.id;
  // A former stored shape (freehand points before docs/specs/006-design/stroke-points.md,
  // from a browser loaded before a deploy) is migrated, not refused.
  const read = await readBody(ctx);
  if (read instanceof Response) return read;
  const received = migrateIncomingTab(read) as Tab;
  // Structural schema gate (shared with the app, @livedesign/design): discriminant, required
  // fields, endpoints, array bounds + unique ids.
  if (!isValidTab(received)) return badRequest('invalid tab');
  // Byte cap on the single tab (the body cap bounds the whole request; this bounds one tab's
  // element + comment tree). See bodyExceedsCap for why the header alone isn't enough.
  if (bodyExceedsCap(request, received, MAX_TAB_BYTES)) return payloadTooLarge();
  const incoming = withoutRecordFields({ ...received, id: tabId });
  const seenHeader = request.headers.get(CHANGESET_SEEN_HEADER);
  const seen = parseChangesetSeen(seenHeader);
  if (seenHeader !== null && seen === null) {
    console.warn('[changeset] seen-invalid', { designId: id, tabId, length: seenHeader.length });
  }

  // The writer's profile, asked for now so it overlaps the reads below rather than following them.
  const writer = getParticipant(env, owner);

  const scoped = (grantOn(ctx, id)?.tabScope ?? null) !== null;
  for (let attempt = 1; attempt <= TAB_SAVE_CAS_ATTEMPTS; attempt += 1) {
    // The stored tab and the changesets this editor had not seen, read together. Changesets merge
    // first, so their before-image compare sees the save as sent; then the room's ledger.
    // The room's ledger is fetched alongside them (it needs only the tab's id), and merged after.
    const [existingTab, merge, fetchedLedger] = await Promise.all([
      getTab(env, id, tabId),
      mergeUnseenChangesets(ctx, incoming, seen),
      fetchRoomLedger(env, id, tabId, request.headers.get('X-Room-Cursor')),
    ]);
    const ledger = applyRoomLedger(merge.tab, fetchedLedger);
    const commentAuthors = ledger.commentAuthors;
    // A copy: each attempt starts again from the save as sent.
    const body: Tab = { ...ledger.tab };
    // The name cap (docs/specs/006-design/name-length.md): a new or changed name is shortened;
    // an autosave echoing the stored name unchanged keeps it.
    body.name = capStoredName(body.name, existingTab?.name ?? null, 'tab');
    // A tab's name is structure (docs/specs/013-workspace/tab-scoped-share-links.md): a tab-scoped
    // editor's save stores its content under the name the tab already has.
    if (scoped && existingTab) body.name = existingTab.name;
    // Data-loss backstop (docs/specs/006-design/per-tab-storage.md): refuse to blank a tab that
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
    const orderIndex = existingTab?.orderIndex ?? existing.tabCount;
    // Newly added comments carry the resolved owner's profile, never the client's claim
    // (docs/specs/014-identity/auth-and-guest-access.md). Remembered per isolate for a minute
    // (accounts/profiles.ts), so an autosave asks the accounts Worker at most once a minute, and
    // asked before the loop, so that ask overlaps the tab's own reads. With no profile (a guest who set no name, or
    // the accounts Worker out of reach) the writer is still the owner: the comments already stored stay locked.
    const writerParticipant = await writer;
    const sanitised: Tab = {
      ...body,
      elements: rewriteCommentAuthors(
        body.elements,
        existingTab?.elements ?? [],
        writerParticipant ?? { id: owner, name: '', color: '', createdAt: 0 },
        commentAuthors,
      ),
    };
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
      console.warn('[changeset] lost-race', { designId: id, tabId, attempt, write: 'save' });
      continue;
    }
    logMerge(id, tabId, merge);
    // docs/specs/014-identity/transactional-email.md (#1): an edit-role visitor adding a comment
    // notifies the owner; on a team design, the teammates the writer's new comments @-mention hear of it
    // (docs/specs/012-collaboration/comment-mentions.md). Their own comments only, read from the authors the
    // server just set.
    // Only a save that could email anyone looks: a visitor's (the owner's email), or any on a team design (mentions).
    const fresh =
      emailEnabled(env) && (owner !== existing.ownerId || existing.teamId)
        ? newCommentsBy(sanitised.elements, existingTab?.elements ?? [], owner)
        : [];
    if (fresh.length > 0 && owner !== existing.ownerId) {
      ctx.waitUntil?.(
        notifyNewComment(
          env,
          { id, ownerId: existing.ownerId, name: existing.name },
          writerParticipant?.name ?? null,
        ),
      );
    }
    if (existing.teamId && fresh.some((c) => c.mentions?.length)) {
      ctx.waitUntil?.(
        notifyMentions(env, {
          design: { id, name: existing.name, teamId: existing.teamId },
          authorId: owner,
          authorFallbackName: ctx.accountEmail,
          comments: fresh,
        }),
      );
    }
    // Echo what was just written instead of reading it back; folder is link metadata the client
    // strips before persisting, so it is absent by design.
    return json({
      tab: {
        ...sanitised,
        id: tabId,
        name: body.name,
        designId: id,
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
  ctx: DesignRouteContext,
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

function logMerge(designId: string, tabId: string, merge: MergeOutcome): void {
  if (merge.merged > 0) {
    console.info('[changeset] merged-on-save', {
      designId,
      tabId,
      records: merge.records,
      elements: merge.merged,
    });
  }
  if (merge.superseded > 0) {
    console.info('[changeset] superseded-on-save', {
      designId,
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
