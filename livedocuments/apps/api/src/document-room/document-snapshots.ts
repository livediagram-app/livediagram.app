// A document's snapshots (docs/specs/013-workspace/snapshots.md; liveworkspace/docs/specs/014-snapshots/snapshots.md):
// the thin door onto @liveworkspace/snapshots. A snapshot is the document's own file (document-file.ts), and a revert
// reads it back keeping every tab's id, writes its tabs and deck in place, then tells the room, which forgets its
// ledger and closes every socket so each open editor reloads onto the reverted document.

import type { Tab } from '@livedocuments/document';
import {
  serveSnapshots,
  type SnapshotCaller,
  type SnapshotDoor,
} from '@liveworkspace/snapshots/server';
import { replaceTabs } from '../db/tabs';
import { authorOf } from '../routes/changesets';
import { gateEdit, type DocumentRouteContext } from '../routes/context';
import { hearsEvent, keptSnapshots, queueEvent, silently } from '@liveworkspace/automations/room';
import { setDocumentPresentation } from './document-content';
import { exportDocumentFile, readDocumentFile } from './document-file';

export function documentSnapshotDoor(
  env: DocumentRouteContext['env'],
  documentId: string,
): SnapshotDoor {
  return {
    exportFile: async () => {
      const file = await exportDocumentFile(env, documentId, null);
      if (file.status !== 'ok') return null;
      return typeof file.body === 'string' ? file.body : new TextDecoder().decode(file.body);
    },
    replaceContent: async (text) => {
      const read = readDocumentFile(text, { keepIds: true });
      if (!read.ok) return read.failure === 'too_large' ? 'too_large' : 'invalid';
      const tabs = read.content.copy.tabs.map((t) => ({
        tab: { ...(JSON.parse(t.data) as Omit<Tab, 'id' | 'name'>), id: t.id, name: t.name },
        folder: t.folder,
      }));
      // Nothing a revert rewrites is an edit, a tab added or a tab removed to the document's rules, whoever reverts
      // (docs/specs/013-workspace/automations.md; liveworkspace 018-automations "Revert to Snapshot"). Its rules stay
      // as they are: a snapshot puts back content, never a rule.
      await silently(env, async () => {
        await replaceTabs(env, documentId, tabs);
        await setDocumentPresentation(env, documentId, read.content.presentation);
      });
      return 'ok';
    },
    afterRevert: (generation) => env.SNAPSHOT_REVERTED?.(generation),
    // The snapshots the document's rules revert to: kept beside the latest five, and not deletable.
    kept: () => keptSnapshots(env),
  };
}

// Editors of the whole document: a tab-scoped link, a workbench embed and a Participant or Viewer see nothing, and an
// API token is refused before anything is read.
async function snapshotCaller(
  ctx: DocumentRouteContext,
  documentId: string,
): Promise<SnapshotCaller> {
  const owner = ctx.resolveOwner();
  const mayUse = owner !== null && !ctx.workbench && (await gateEdit(ctx, documentId));
  return {
    token: ctx.token !== null,
    mayUse,
    person: mayUse && owner !== null ? await authorOf(ctx, owner) : null,
  };
}

// Every request the room answers passes here: `/api/documents/<id>/snapshots...` is answered, a write on the document
// from before a revert is fenced, and the rest go on to `handle`.
export async function serveDocumentSnapshots(
  ctx: DocumentRouteContext,
  handle: () => Promise<Response>,
): Promise<Response> {
  const [api, collection, documentId, ...rest] = ctx.segments;
  if (api !== 'api' || collection !== 'documents' || !documentId) return handle();
  const answer = await serveSnapshots({
    db: ctx.env.DOCUMENT_DB,
    itemId: documentId,
    request: ctx.request,
    rest,
    caller: () => snapshotCaller(ctx, documentId),
    door: () => documentSnapshotDoor(ctx.env, documentId),
    handle,
  });
  // Snapshot Taken (docs/specs/013-workspace/automations.md): a person's take, never a rule's own or a revert's
  // safety snapshot.
  const taken =
    rest.length === 1 &&
    rest[0] === 'snapshots' &&
    ctx.request.method.toUpperCase() === 'POST' &&
    answer.status === 201;
  if (taken && hearsEvent(ctx.env, 'snapshot_taken')) {
    const owner = ctx.resolveOwner();
    queueEvent(ctx.env, {
      id: `snapshot:${crypto.randomUUID()}`,
      kind: 'snapshot_taken',
      at: Date.now(),
      ...(owner !== null ? { by: await authorOf(ctx, owner), role: 'editor' as const } : {}),
    });
  }
  return answer;
}
