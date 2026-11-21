// A document's snapshots (docs/specs/013-workspace/snapshots.md; liveworkspace/docs/specs/014-snapshots/snapshots.md):
// the thin door onto @liveworkspace/snapshots. A snapshot is the document's own file (document-file.ts), and a revert
// reads it back keeping every tab's id, writes its tabs and deck in place, then tells the room, which forgets its
// ledger and closes every socket so each open editor reloads onto the reverted document.

import {
  DEFAULT_KNOWLEDGE_SETTINGS,
  DEFAULT_KNOWLEDGE_STYLE,
  type Tab,
} from '@liveknowledge/document';
import {
  serveSnapshots,
  type SnapshotCaller,
  type SnapshotDoor,
} from '@liveworkspace/snapshots/server';
import { replaceTabs } from '../db/tabs';
import { authorOf } from '../routes/changesets';
import { gateEdit, type DocumentRouteContext } from '../routes/context';
import {
  setDocumentPresentation,
  setKnowledgeSettings,
  setKnowledgeStyle,
} from './document-content';
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
      await replaceTabs(env, documentId, tabs);
      await setDocumentPresentation(env, documentId, read.content.presentation);
      // The Review Period as the snapshot held it; one that names none held the default.
      await setKnowledgeSettings(
        env,
        documentId,
        read.content.knowledgeSettings ?? DEFAULT_KNOWLEDGE_SETTINGS,
        Date.now(),
      );
      // The Knowledgebase Style as the snapshot held it, on the same terms.
      await setKnowledgeStyle(
        env,
        documentId,
        read.content.knowledgeStyle ?? DEFAULT_KNOWLEDGE_STYLE,
        Date.now(),
      );
      return 'ok';
    },
    afterRevert: (generation) => env.SNAPSHOT_REVERTED?.(generation),
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
export function serveDocumentSnapshots(
  ctx: DocumentRouteContext,
  handle: () => Promise<Response>,
): Promise<Response> {
  const [api, collection, documentId, ...rest] = ctx.segments;
  if (api !== 'api' || collection !== 'documents' || !documentId) return handle();
  return serveSnapshots({
    db: ctx.env.DOCUMENT_DB,
    itemId: documentId,
    request: ctx.request,
    rest,
    caller: () => snapshotCaller(ctx, documentId),
    door: () => documentSnapshotDoor(ctx.env, documentId),
    handle,
  });
}
