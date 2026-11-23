// A knowledgebase's page Trash (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"):
//   GET    /api/documents/<id>/trash                    the Trash, newest first        a Writer
//   POST   /api/documents/<id>/trash/<page>/restore     a page and its subpages back   a Writer
//   DELETE /api/documents/<id>/trash/<page>             one deleted forever             an Editor
//   DELETE /api/documents/<id>/trash                    Empty Trash                     an Editor
// Each is a person's, in the editor, on the whole knowledgebase: a token (an agent) is refused, as is a link confined
// to one page, a Viewer and a Community visitor. A page reaches the Trash by the tab DELETE
// (document-subresource-routes.ts), whoever sends it.
import { NOT_IN_TRASH, TRASH_IS_A_PERSONS } from '@liveknowledge/api-schema';
import { pageCount } from '@liveknowledge/document';
import { readStoredPages } from '../document-room/page-tree-store';
import { countPages, pagesRefused, workerTierOf } from '../knowledge/tier-limits';
import { getDocument } from '../db';
import { deleteForever, emptyTrash, listTrash, restorePages } from '../document-room/page-trash';
import { conflict, forbidden, json, methodNotAllowed, noContent } from '../responses';
import { relayDocumentTree } from '../room-tree';
import { gateGrant, missingDocument, writesPages, type DocumentRouteContext } from './context';

const notInTrash = () =>
  json({ error: NOT_IN_TRASH, message: 'That page is not in the Trash.' }, { status: 404 });

/** Whether the path is one of this file's routes, read by its literal segments and length (the route probe's
 *  parity test sees each one). */
function isTrashPath(segments: readonly string[]): boolean {
  if (segments[1] !== 'documents' || segments[3] !== 'trash') return false;
  if (segments.length === 4) return true;
  if (segments.length === 5) return !!segments[4];
  return segments.length === 6 && !!segments[4] && segments[5] === 'restore';
}

/** Null when the path is not a Trash route. */
export async function handlePageTrashRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const { segments, request, env } = ctx;
  if (!isTrashPath(segments)) return null;
  const id = segments[2]!;
  const document = await getDocument(env, id);
  if (!document) return missingDocument(ctx, id);
  const grant = await gateGrant(ctx, id, document.ownerId, document.teamId);
  if (!grant) return forbidden();
  // An agent never lists, restores or empties the Trash: its delete moves a page there, and a person decides.
  if (ctx.token) return forbidden(TRASH_IS_A_PERSONS);
  if (grant.tabScope !== null || grant.community || !writesPages(grant)) return forbidden();
  const editor = grant.role === 'edit';
  const method = request.method;
  const page = segments[4];
  if (segments.length === 4) {
    if (method === 'GET') return json({ pages: await listTrash(env, id) });
    if (method !== 'DELETE') return methodNotAllowed();
    if (!editor) return forbidden();
    await emptyTrash(env, id);
    console.info('[trash] emptied', { documentId: id });
    return noContent();
  }
  if (segments.length === 6) {
    if (method !== 'POST') return methodNotAllowed();
    // The pages back are told to the owner's Knowledgebase Pages first (tiers.md): refused there, none come back.
    const entry = (await listTrash(env, id)).find((p) => p.id === page);
    const restoring = entry ? 1 + entry.subpages.length : 0;
    if (restoring > 0) {
      const tier = await workerTierOf(env, document);
      const stored = await readStoredPages(env, id);
      const over = await countPages(tier, id, pageCount(stored) + restoring);
      if (over) return pagesRefused(tier, over);
    }
    const outcome = await restorePages(env, id, page!);
    if (outcome === 'not_in_trash') return notInTrash();
    if (outcome === 'page_limit') return conflict('page_limit');
    console.info('[trash] restored', {
      documentId: id,
      pages: outcome.restored.length,
      topLevel: outcome.topLevel,
    });
    // Every open editor gets the pages back as placeholders its lazy load fills, the one that asked included.
    await relayDocumentTree(env, id, '[trash]');
    return json(outcome);
  }
  if (method !== 'DELETE') return methodNotAllowed();
  if (!editor) return forbidden();
  if (!(await deleteForever(env, id, page!))) return notInTrash();
  console.info('[trash] deleted forever', { documentId: id });
  return noContent();
}
