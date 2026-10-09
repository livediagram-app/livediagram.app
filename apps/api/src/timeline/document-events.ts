// Document lifecycle + collaboration events (docs/specs/013-workspace/timeline.md §4.2, §4.3).
//
// One exported function per event, so a route's emit is a single line
// and the copy for a given event lives in exactly one place. The
// title/description split is load-bearing: titles are Title Case
// categories that never carry user content, which is what lets four
// bubbles collapse into one honest stacked headline (docs/specs/013-workspace/timeline.md §2.1).

import { HOME_OPENED_EVENT_TYPE, TIMELINE_COMMENT_MAX } from '@livediagram/api-schema';
import type { TimelineScopeRef } from '@livediagram/api-schema';
import { dedupeKeyForDay, dedupeKeyOnce } from '../db/timeline';
import type { DocumentDTO, Runtime } from '../types';
import { audienceForDocument, mergeScopes, userScope } from './audience';
import { record, truncate } from './record';

type DocumentRef = Pick<DocumentDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

// Shared snapshot so every document bubble can render its name and link
// without the reader fanning out into the documents table — and so a
// deleted document's tombstone still knows what it was called.
function documentSnapshot(liveDoc: DocumentRef): Record<string, unknown> {
  return { documentId: liveDoc.id, documentName: liveDoc.name };
}

/** Whether a making counts as a use of the document for its maker
 *  (docs/specs/013-workspace/explorer-home.md "Making a document"). */
export type Making = { markUsed: boolean };

// A making that counts carries `markUsed: true`, which Explorer Home's Jump back in reads
// (MARKED_MAKING, db/home.ts); one that does not carries nothing, as every making before the mark.
function makingSnapshot(making: Making): Record<string, unknown> {
  return making.markUsed ? { markUsed: true } : {};
}

export async function recordDocumentCreated(
  env: Runtime,
  liveDoc: DocumentRef,
  actorId: string,
  making: Making,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'document_created',
      title: 'Document Created',
      description: liveDoc.name,
      snapshot: { ...documentSnapshot(liveDoc), ...makingSnapshot(making) },
    },
    await audienceForDocument(env, liveDoc),
  );
}

export async function recordDocumentDuplicated(
  env: Runtime,
  copy: DocumentRef,
  sourceName: string,
  actorId: string,
  making: Making,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: copy.id,
      eventType: 'document_duplicated',
      title: 'Document Duplicated',
      description: `${sourceName} → ${copy.name}`,
      snapshot: { ...documentSnapshot(copy), sourceName, ...makingSnapshot(making) },
    },
    await audienceForDocument(env, copy),
  );
}

// There is deliberately no recordDocumentDeleted. A deleted document is
// swept from the feed (docs/specs/013-workspace/timeline.md §3.5) and nothing is written in its
// place: from the Timeline's point of view it never existed.

export async function recordDocumentMoved(
  env: Runtime,
  liveDoc: DocumentRef,
  destination: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'document_moved',
      dedupeKey: dedupeKeyOnce(),
      title: 'Moved to a Folder',
      description: `${liveDoc.name} → ${destination}`,
      snapshot: { ...documentSnapshot(liveDoc), destination },
    },
    await audienceForDocument(env, liveDoc),
  );
}

// A document was published INTO a team library. The out direction is
// recordTeamDocumentRemoved below — it needs a different title, a different
// audience and an owner change, so it could not share this one.
export async function recordTeamDocumentAdded(
  env: Runtime,
  liveDoc: DocumentRef,
  teamName: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'team_document_added',
      dedupeKey: dedupeKeyOnce(),
      title: 'Shared with a Team',
      description: `${liveDoc.name} → ${teamName}`,
      snapshot: { ...documentSnapshot(liveDoc), teamName },
    },
    await audienceForDocument(env, liveDoc),
  );
}

// A document was pulled back OUT of a team library into personal files
// (docs/specs/013-workspace/team-shared-documents.md + docs/specs/013-workspace/timeline.md). Not the same event as `document_moved`, which is
// personal tidying: the team loses the document outright, and when the mover
// isn't the owner they take ownership of it too — so the previous owner loses
// it as well.
//
// The audience is passed IN rather than resolved here, because by the time this
// fires the document is already personal and `audienceForDocument` would return
// only its new owner. The caller resolves the OLD team's audience before the
// move, exactly as the delete path does for the same reason.
export async function recordTeamDocumentRemoved(
  env: Runtime,
  liveDoc: DocumentRef,
  teamName: string,
  actorId: string,
  audience: TimelineScopeRef[],
  newOwnerName: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'team_document_removed',
      dedupeKey: dedupeKeyOnce(),
      title: 'Removed from a Team',
      description: `${liveDoc.name} → ${teamName}`,
      snapshot: {
        ...documentSnapshot(liveDoc),
        teamName,
        ...(newOwnerName ? { newOwnerName } : {}),
      },
    },
    audience,
  );
}

// The coalesced editing event (docs/specs/013-workspace/timeline.md §4.2).
//
// Emitted from the tab-save path. The dedupe key collapses a
// whole day of saves by one person on one document into a single row
// whose occurred_at walks forward — otherwise the highest-volume write
// in the product would bury every other event kind, stacking or not.
export async function recordDocumentEdited(
  env: Runtime,
  liveDoc: DocumentRef,
  actorId: string,
): Promise<void> {
  const now = Date.now();
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'document_edited',
      dedupeKey: dedupeKeyForDay(actorId, now),
      title: 'Document Updated',
      // Actor-relative copy is resolved by the renderer ("You worked
      // on X" vs "Priya edited X"), so the stored description stays
      // viewer-agnostic and one row serves the whole audience.
      description: liveDoc.name,
      occurredAt: now,
      snapshot: documentSnapshot(liveDoc),
    },
    await audienceForDocument(env, liveDoc),
  );
}

export async function recordCommentAdded(
  env: Runtime,
  liveDoc: DocumentRef,
  // `reply`: not the first comment of its thread (Explorer Home says "replied").
  comment: { id: string; text: string; authorName: string; authorColor?: string; reply: boolean },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      // The comment id, not the document id: two comments on one
      // document are two events, and the UNIQUE key is what stops a
      // retried save re-emitting the same one.
      sourceId: comment.id,
      eventType: 'comment_added',
      title: 'Comment Added',
      description: truncate(comment.text, TIMELINE_COMMENT_MAX),
      snapshot: {
        ...documentSnapshot(liveDoc),
        authorName: comment.authorName,
        authorColor: comment.authorColor ?? null,
        reply: comment.reply,
      },
    },
    await audienceForDocument(env, liveDoc),
  );
}

export async function recordCommentResolved(
  env: Runtime,
  liveDoc: DocumentRef,
  threadKey: string,
  // The thread's opening comment, so the feed can say what was resolved.
  text: string | null,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: threadKey,
      eventType: 'comment_resolved',
      title: 'Comment Resolved',
      description: text ? truncate(text, TIMELINE_COMMENT_MAX) : liveDoc.name,
      snapshot: documentSnapshot(liveDoc),
    },
    await audienceForDocument(env, liveDoc),
  );
}

// An action was assigned on an element (docs/specs/012-collaboration/assigned-actions.md). Reaches the assignee
// as well as everyone who can see the document — usually overlapping
// sets, which is what mergeScopes is for. When the assignee is an
// invited-but-not-joined member they have no owner id yet, so they get
// the event once they join and the document audience covers them.
export async function recordActionAssigned(
  env: Runtime,
  liveDoc: DocumentRef,
  action: { id: string; name: string; assigneeId: string | null; assigneeName: string | null },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: action.id,
      eventType: 'action_assigned',
      title: 'Action Assigned',
      description: action.assigneeName ? `${action.name} → ${action.assigneeName}` : action.name,
      snapshot: {
        ...documentSnapshot(liveDoc),
        actionName: action.name,
        assigneeName: action.assigneeName,
        // Who it went to, so Explorer Home can say "assigned you an action" to them alone.
        assigneeId: action.assigneeId,
      },
    },
    mergeScopes(
      await audienceForDocument(env, liveDoc),
      action.assigneeId ? [userScope(action.assigneeId)] : [],
    ),
  );
}

export async function recordActionCompleted(
  env: Runtime,
  liveDoc: DocumentRef,
  action: { id: string; name: string },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: action.id,
      eventType: 'action_completed',
      title: 'Action Completed',
      description: action.name,
      snapshot: { ...documentSnapshot(liveDoc), actionName: action.name },
    },
    await audienceForDocument(env, liveDoc),
  );
}

// Share-link events are owner-only: who a document is shared with is the
// owner's business, and a team member seeing "a link was created" adds
// nothing they can act on.
export async function recordShareLinkCreated(
  env: Runtime,
  liveDoc: DocumentRef,
  role: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: `${liveDoc.id}:${role}`,
      eventType: 'share_link_created',
      dedupeKey: dedupeKeyOnce(),
      title: 'Share Link Created',
      description: liveDoc.name,
      snapshot: { ...documentSnapshot(liveDoc), role },
    },
    [userScope(liveDoc.ownerId)],
  );
}

// Future-dated: occurredAt is the expiry, not now, so this lands in the
// feed's forward band above Today (docs/specs/013-workspace/timeline.md §4.5). That band is the
// only reason a user opens the Timeline BEFORE something breaks.
export async function recordShareLinkExpiring(
  env: Runtime,
  liveDoc: DocumentRef,
  expiresAt: number,
): Promise<void> {
  await record(
    env,
    {
      actorId: null,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'share_link_expiring',
      title: 'Share Link Expiring',
      description: liveDoc.name,
      occurredAt: expiresAt,
      snapshot: { ...documentSnapshot(liveDoc), expiresAt },
    },
    [userScope(liveDoc.ownerId)],
  );
}

// Offline Mode conversions (docs/specs/006-document/offline-mode.md). Owner-only: an offline document
// exists in exactly one browser, so nobody else has a stake in it.
export async function recordDocumentOffline(
  env: Runtime,
  liveDoc: DocumentRef,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'document_offline',
      dedupeKey: dedupeKeyOnce(),
      title: 'Taken Offline',
      description: liveDoc.name,
      // No documentId: the server copy is gone, so the row must not link
      // anywhere. Same structural trick as the delete tombstone.
      snapshot: { documentName: liveDoc.name },
    },
    [userScope(actorId)],
  );
}

export async function recordDocumentSynced(
  env: Runtime,
  liveDoc: DocumentRef,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'document_synced',
      dedupeKey: dedupeKeyOnce(),
      title: 'Synced to the Cloud',
      description: liveDoc.name,
      snapshot: documentSnapshot(liveDoc),
    },
    await audienceForDocument(env, liveDoc),
  );
}

// A person opened a document (docs/specs/013-workspace/explorer-home.md "Opens"). Private: scoped
// to the person alone, never the document's history or a team's feed, and left out of the
// Timeline feed (docs/specs/013-workspace/timeline.md §4.2); Home's Timeline column reads it by
// actor. Called once per person per document per UTC day, by recordDocumentOpen, which owns the
// dedupe; the day key makes a retry land on the same row.
export async function recordDocumentOpened(
  env: Runtime,
  liveDoc: DocumentRef,
  personId: string,
  at: number,
): Promise<void> {
  await record(
    env,
    {
      actorId: personId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: HOME_OPENED_EVENT_TYPE,
      dedupeKey: dedupeKeyForDay(personId, at),
      title: 'Document Opened',
      description: liveDoc.name,
      occurredAt: at,
      snapshot: documentSnapshot(liveDoc),
    },
    [userScope(personId)],
  );
}

// Somebody followed a share link and opened the document.
//
// Owner-only, and coalesced per visitor per day: this is the one event a
// stranger can trigger at will, so an uncoalesced emit would let anyone
// with a link flood an owner's feed by refreshing. The dedupe key makes
// a hundred opens one row.
export async function recordVisitorOpened(
  env: Runtime,
  liveDoc: DocumentRef,
  visitorId: string,
  visitorName: string | null,
): Promise<void> {
  const now = Date.now();
  await record(
    env,
    {
      // The visitor is the actor, but the row is scoped to the owner —
      // so it survives the "Other people" filter, which is exactly the
      // audience for "somebody opened your document".
      actorId: visitorId,
      sourceType: 'document',
      sourceId: liveDoc.id,
      eventType: 'document_opened_by_visitor',
      dedupeKey: dedupeKeyForDay(visitorId, now),
      title: 'Opened by a Visitor',
      description: liveDoc.name,
      occurredAt: now,
      snapshot: { ...documentSnapshot(liveDoc), visitorName },
    },
    [userScope(liveDoc.ownerId)],
  );
}

export async function recordVisitorCopied(
  env: Runtime,
  liveDoc: DocumentRef,
  visitorId: string,
  visitorName: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId: visitorId,
      sourceType: 'document',
      sourceId: `${liveDoc.id}:${visitorId}:copied`,
      eventType: 'document_copied_by_visitor',
      title: 'Copied by a Visitor',
      description: liveDoc.name,
      snapshot: { ...documentSnapshot(liveDoc), visitorName },
    },
    [userScope(liveDoc.ownerId)],
  );
}
