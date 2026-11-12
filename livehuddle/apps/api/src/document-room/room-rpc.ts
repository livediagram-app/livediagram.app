import {
  openRoomSockets,
  recordItemEditor,
  type ConnectedTabOutcome,
  type ExportQuery,
  type ExportResult,
} from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import { documentHasTab } from '../db/tabs';
import { documentPlacesImage } from '../db/image-refs';
import { documentMayServeImage } from '../db/image-grants';
import { notifyDocumentJoin } from '../email/notifications';
import { communityCheckDueAt, openCommunityCode, readCommunityPost } from './community-post';
import { anonymiseDocument } from './document-anonymise';
import { drawDocument } from '../thumbnail';
import {
  exportDocumentCopy,
  readDocumentHead,
  readDocumentMeta,
  type DocumentCopy,
} from './document-content';
import { DOCUMENT_OUTBOX } from './document-outbox';
import { addConnectedDocumentTab, connectedTabArrival } from './connected-tab';
import { hasDocumentSchema } from './document-schema';
import { documentShares, type ShareAnswer, type ShareMessage } from './tab-shares';
import { answerDocumentRequest, isDocumentCreate, type RouteIdentity } from './document-route';
import { communityOf } from './room-community';
import type { DocumentRoom } from './document-room';

// The bodies of what the worker asks of a document (document-room.ts "RPC", document-client.ts): the class keeps
// each method and hands it here with the room it acts for.

// What the export door answers a drawing as.
const SVG_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

export async function route(
  room: DocumentRoom,
  documentId: string,
  request: Request,
  identity: RouteIdentity,
): Promise<Response> {
  room.bindDocument(documentId);
  const env = room.requireEnv();
  if (identity.grant?.item === documentId) await room.takeHead(identity.grant);
  const community = await communityOf(room, documentId);
  const writesBefore = room.writes;
  const response = await answerDocumentRequest(
    env,
    request,
    identity,
    (p) => room.state.waitUntil(p),
    community,
  );
  // A request that wrote is an edit by whoever asked: their History entry and a Most Used day
  // (@liveworkspace/index-app recordItemEditor). Reads, refusals and requests that changed nothing are not, nor is
  // the create, the canvas's making (isDocumentCreate).
  if (response.ok && identity.owner && room.writes > writesBefore) {
    if (!isDocumentCreate(request)) {
      const sql = room.state.storage.sql;
      recordItemEditor(
        (q, ...b) => sql.exec(q, ...b),
        DOCUMENT_OUTBOX,
        documentId,
        identity.owner,
        Date.now(),
      );
    }
    room.noteWrite();
  }
  // A post published or removed by this request starts or stops its checks.
  if (request.method !== 'GET' && new URL(request.url).pathname.endsWith('/community'))
    room.communityAt = communityCheckDueAt(await readCommunityPost(env));
  room.armAlarm();
  return response;
}

// Take the owner and team a grant names as the canvas's own copy. A failure is logged, never the caller's: the
// next grant tries again.
export async function takeHead(
  room: DocumentRoom,
  grant: { owner?: string | null; team: string | null },
): Promise<void> {
  if (!room.roomEnv) return;
  try {
    await room.head.sync(grant);
  } catch (err) {
    console.warn('[room] owner and team not taken from the grant', { error: String(err) });
  }
}

// The export door (liveworkspace/docs/specs/006-media/previews.md, routes/internal-items.ts): the canvas drawn as an SVG, the first
// tab or one, with its last save as the version. Through the canvas's Community post's link it is the redacted
// drawing, and nothing while the post does not open the canvas. Unchanged since `ifVersion`, it is not drawn.
export async function exportImage(
  room: DocumentRoom,
  documentId: string,
  query: ExportQuery,
): Promise<ExportResult> {
  room.bindDocument(documentId);
  if (!room.hasSchema()) return { status: 'not_found' };
  const env = room.requireEnv();
  const { meta, savedAt } = await readDocumentHead(env, documentId);
  if (!meta) return { status: 'not_found' };
  let community = false;
  if (query.code !== null) {
    const post = await readCommunityPost(env);
    if (post?.shareCode === query.code) {
      if (openCommunityCode(env, post, meta) !== query.code) return { status: 'not_found' };
      community = true;
    }
  }
  if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
  if (query.tabId !== null && !(await documentHasTab(env, documentId, query.tabId))) {
    return { status: 'not_found' };
  }
  const svg = await drawDocument(
    env,
    { id: documentId, name: meta.name },
    query.tabId,
    { defer: (p) => room.state.waitUntil(p), appearance: query.appearance },
    community,
  );
  return svg === null
    ? { status: 'empty', version: savedAt }
    : { status: 'ok', body: svg, contentType: SVG_CONTENT_TYPE, version: savedAt };
}

// The index's reverse write of a connected tab (connected-tab.ts): appended at the end of the tab bar, and everyone
// with the Space open sees it arrive, as an ordered system op a blipped socket replays.
export async function addConnectedTab(
  room: DocumentRoom,
  documentId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  room.bindDocument(documentId);
  if (!room.hasSchema()) return 'not_found';
  const env = room.requireEnv();
  const outcome = await addConnectedDocumentTab(env, documentId, write);
  if (typeof outcome === 'object' && outcome.made) {
    const op = await connectedTabArrival(env, documentId);
    if (op) room.sequenceMutation('system', op);
  }
  return outcome;
}

// Whether the canvas places this image (on one tab, for a tab-scoped visitor) and may serve it
// (db/image-grants.ts): the byte endpoint's share check, answered where both live.
export async function servesImage(
  room: DocumentRoom,
  documentId: string,
  imageId: string,
  onlyTabId: string | null,
): Promise<boolean> {
  room.bindDocument(documentId);
  const env = room.requireEnv();
  if (!(await documentPlacesImage(env, documentId, imageId, onlyTabId))) return false;
  return documentMayServeImage(env, documentId, imageId);
}

// The source side of a copy, for whoever copies (the index names them and the link they came through): anyone
// but the owner takes the comments as the tab read serves them to them; a copy through the canvas's open
// Community post's link takes it without its comments or the people on its actions (docs/specs/025-community/
// community.md "Making a copy"). `community` says which, so the copy is counted toward the post.
export async function exportCopy(
  room: DocumentRoom,
  documentId: string,
  onlyTabId: string | null,
  copier: { by: string | null; code: string | null } | null,
): Promise<{ copy: DocumentCopy; community: boolean } | null> {
  room.bindDocument(documentId);
  if (!room.hasSchema()) return null;
  const env = room.requireEnv();
  const meta = await readDocumentMeta(env, documentId);
  if (!meta) return null;
  const post = copier?.code ? await communityOf(room, documentId) : null;
  const community = post !== null && post.open && post.code === copier?.code;
  const by = copier?.by ?? null;
  const copy = await exportDocumentCopy(
    env,
    documentId,
    onlyTabId,
    by !== null && by !== meta.ownerId ? by : null,
    community,
  );
  return copy ? { copy, community } : null;
}

// Share links the index revoked or rescoped: each one's sessions hear it and end now. `rescoped`: they reload
// into what the link opens now.
export async function revokeCodes(
  room: DocumentRoom,
  documentId: string,
  codes: string[],
  reason: 'revoked' | 'rescoped',
): Promise<number> {
  room.bindDocument(documentId);
  let closed = 0;
  for (const code of codes) {
    const op = { kind: reason === 'rescoped' ? 'share-rescoped' : 'share-revoked', code };
    const before = openRoomSockets(room.state.getWebSockets()).length;
    room.broadcastSystemOp(op);
    room.closeSessionsOfChangedLink(op);
    await room.clearAgentsFor(op);
    closed += before - openRoomSockets(room.state.getWebSockets()).length;
  }
  return closed;
}

// Someone opened the canvas through a share link for the first time: the owner hears of it
// (email/notifications.ts notifyDocumentJoin), off the caller's path. A canvas never started has no owner to tell.
export async function joined(
  room: DocumentRoom,
  documentId: string,
  personId: string,
): Promise<void> {
  room.bindDocument(documentId);
  if (!room.hasSchema()) return;
  const env = room.requireEnv();
  const meta = await readDocumentMeta(env, documentId);
  if (!meta) return;
  room.state.waitUntil(
    notifyDocumentJoin(env, { id: documentId, ownerId: meta.ownerId, name: meta.name }, personId),
  );
}

// A closed account's name off this canvas (document-anonymise.ts): the index's person purge, through the api.
export async function anonymise(
  room: DocumentRoom,
  documentId: string,
  personId: string,
): Promise<number> {
  room.bindDocument(documentId);
  // A canvas never started (or purged) holds nothing of anyone: read its storage as it is, without making the
  // schema and document row a first query would.
  const sql = room.state.storage.sql;
  const started =
    room.hasSchema() &&
    sql.exec('SELECT 1 FROM document WHERE id = ? AND created_at > 0', documentId).toArray()
      .length > 0;
  if (!started) return 0;
  const changed = await anonymiseDocument(room.requireEnv(), documentId, personId);
  // The owner may have been the one anonymised: the next grant reads the stored copy again.
  room.head.forget();
  if (changed > 0) console.info('[room] anonymised a closed account', { rows: changed });
  return changed;
}

// What another holder of a shared tab sent. A document with nothing stored holds no tab, and makes no schema
// to say so.
export async function receiveShares(
  room: DocumentRoom,
  documentId: string,
  from: string,
  messages: ShareMessage[],
): Promise<ShareAnswer[]> {
  const sql = room.state.storage.sql;
  if (room.documentId === null && !hasDocumentSchema((q) => sql.exec(q))) {
    return messages.map(() => 'gone');
  }
  room.bindDocument(documentId);
  return documentShares.receive(room.requireEnv(), documentId, from, messages);
}
