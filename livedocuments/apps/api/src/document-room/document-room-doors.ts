// The bodies of the room's RPC doors (document-room.ts) that do more than one read: what the worker asks of a document
// (its routes, the Community post, the export door, copies, share links, a closed account). Each takes the room.
import {
  openRoomSockets,
  recordItemEditor,
  type ExportCommentsResult,
  type ExportQuery,
  type ExportResult,
} from '@liveworkspace/index-app';
import { documentHasTab } from '../db/tabs';
import { documentMayServeImage } from '../db/image-grants';
import { documentPlacesImage } from '../db/image-refs';
import { drawDocument } from '../thumbnail';
import { documentShares, type ShareAnswer, type ShareMessage } from './tab-shares';
import { hasDocumentSchema } from './document-schema';
import { exportDocumentCopyFor, readDocumentHead, readDocumentMeta } from './document-content';
import {
  communityCheckDueAt,
  communityPostAuthor,
  openCommunityCode,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import type { CommunityListing, CopySource } from '../document-client';
import type { Copier } from '@liveworkspace/index-app';
import { notifyDocumentJoin } from '../email/notifications';
import { anonymiseDocument } from './document-anonymise';
import { DOCUMENT_OUTBOX } from './document-outbox';
import { exportDocumentFile } from './document-file';
import { addConnectedDocumentTab, connectedTabArrival } from './connected-tab';
import type { ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import { exportDocumentComments } from './document-comments';
import { answerDocumentRequest, isDocumentCreate, type RouteIdentity } from './document-route';
import type { DocumentRoom } from './document-room';
import { noteWrite } from './document-room-content';
import { closeSessionsOfChangedLink, sequenceMutation } from './document-room-sockets';
import { clearAgentsFor } from './document-room-presence';

// What the export door answers (exportImage).
const SVG_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

export async function route(
  room: DocumentRoom,
  documentId: string,
  request: Request,
  identity: RouteIdentity,
): Promise<Response> {
  room.bindDocument(documentId);
  const env = room.requireEnv();
  // Before the write counter is read: taking the owner and team is no edit.
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
  // the create, the document's making (isDocumentCreate).
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
    noteWrite(room);
  }
  // A post published or removed by this request starts or stops its checks.
  if (request.method !== 'GET' && new URL(request.url).pathname.endsWith('/community')) {
    room.communityAt = communityCheckDueAt(await readCommunityPost(env));
    room.armAlarm();
  }
  return response;
}

// Never makes a schema: a request for an id nothing has written finds no post.
export async function communityOf(
  room: DocumentRoom,
  documentId: string,
): Promise<{ code: string; open: boolean } | null> {
  if (!room.storedSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post) return null;
  const meta = await readDocumentMeta(env, documentId);
  return { code: post.shareCode, open: openCommunityCode(env, post, meta) === post.shareCode };
}

// The post when `code` is its link and it opens the document now; null otherwise.
export async function openPost(
  room: DocumentRoom,
  documentId: string,
  code: string,
): Promise<CommunityPost | null> {
  room.bindDocument(documentId);
  if (!room.storedSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post || post.shareCode !== code) return null;
  const meta = await readDocumentMeta(env, documentId);
  return openCommunityCode(env, post, meta) === code ? post : null;
}

// What a visitor through the document's Community post's open link is told of the post (docs/specs/025-community/
// community.md "Viewing a post's document"): its id at the service and who it shows as author.
export async function communityListing(
  room: DocumentRoom,
  documentId: string,
  code: string,
): Promise<CommunityListing | null> {
  const post = await openPost(room, documentId, code);
  if (!post) return null;
  return { postId: post.postId, author: await communityPostAuthor(room.requireEnv(), post) };
}

// A copy through the document's Community post's link is named after the post (docs/specs/025-community/
// community.md "Viewing a post's document"): its title, when `code` is the post's open link. Null otherwise.
export async function communityPostTitle(
  room: DocumentRoom,
  documentId: string,
  code: string,
): Promise<string | null> {
  return (await openPost(room, documentId, code))?.title ?? null;
}

// The export door (liveworkspace/docs/specs/006-media/previews.md "The export door"): the document drawn on request for
// liveworkspace's previews, which store and serve it and decide when it is stale; nothing is kept here. Versioned
// by the last save, so a preview the service already holds costs one row read. Whether the asker may see the
// document (and, through a link, which tab) is the index's, checked before the service calls.
export async function exportImage(
  room: DocumentRoom,
  documentId: string,
  query: ExportQuery,
): Promise<ExportResult> {
  const sql = room.state.storage.sql;
  if (room.documentId === null && !hasDocumentSchema((q) => sql.exec(q))) {
    return { status: 'not_found' };
  }
  room.bindDocument(documentId);
  const env = room.requireEnv();
  const { meta, savedAt } = await readDocumentHead(env, documentId);
  if (!meta) return { status: 'not_found' };
  // Through the document's Community post's link it is the redacted drawing, and nothing while the post does not
  // open the document (docs/specs/025-community/community.md "Viewing a post's document").
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
  const svg = await drawDocument(env, { id: documentId, name: meta.name }, query.tabId, community);
  return svg === null
    ? { status: 'empty', version: savedAt }
    : { status: 'ok', body: svg, contentType: SVG_CONTENT_TYPE, version: savedAt };
}

// The export door's `file` format (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps", document-file.ts): the
// document's whole envelope, its last save as the version, unread when the caller holds that save.
export async function exportFile(
  room: DocumentRoom,
  documentId: string,
  query: ExportQuery,
): Promise<ExportResult> {
  const sql = room.state.storage.sql;
  if (room.documentId === null && !hasDocumentSchema((q) => sql.exec(q))) {
    return { status: 'not_found' };
  }
  room.bindDocument(documentId);
  return exportDocumentFile(room.requireEnv(), documentId, query.ifVersion);
}

// The export door's `comments` format (liveworkspace/docs/specs/003-accounts/data-export.md "The apps' doors",
// document-comments.ts): every thread in the document with its real authors, for the data export. A document never
// started is not found, and asking does not start it.
export async function exportComments(
  room: DocumentRoom,
  documentId: string,
): Promise<ExportCommentsResult> {
  const sql = room.state.storage.sql;
  if (room.documentId === null && !hasDocumentSchema((q) => sql.exec(q))) {
    return { status: 'not_found' };
  }
  room.bindDocument(documentId);
  return exportDocumentComments(room.requireEnv(), documentId);
}

// The index's reverse write of a connected tab (connected-tab.ts): appended at the end of the tab bar, and everyone
// with the document open sees it arrive, as an ordered system op a blipped socket replays.
export async function addConnectedTab(
  room: DocumentRoom,
  documentId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  room.bindDocument(documentId);
  if (!room.storedSchema()) return 'not_found';
  const env = room.requireEnv();
  const outcome = await addConnectedDocumentTab(env, documentId, write);
  if (typeof outcome === 'object' && outcome.made) {
    const op = await connectedTabArrival(env, documentId);
    if (op) sequenceMutation(room, 'system', op);
  }
  return outcome;
}

// Whether the document places this image (on one tab, for a tab-scoped visitor) and may serve it
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

// The source side of a copy, for whoever copies (document-content.ts exportDocumentCopyFor): anyone but the owner
// takes the comments as the tab read serves them to them; a copy through the document's open Community post's link
// takes it without its comments or the people on its actions (docs/specs/025-community/community.md). `community`
// says which, so the copy is counted toward the post.
export async function exportCopy(
  room: DocumentRoom,
  documentId: string,
  onlyTabId: string | null,
  copier: Copier | null,
): Promise<CopySource | null> {
  room.bindDocument(documentId);
  const env = room.requireEnv();
  const post = copier?.code ? await communityOf(room, documentId) : null;
  const community = post !== null && post.open && post.code === copier?.code;
  const copy = await exportDocumentCopyFor(
    env,
    documentId,
    onlyTabId,
    copier?.by ?? null,
    community,
  );
  return copy ? { copy, community } : null;
}

// Share links the index revoked: each one's sessions hear it and end now, as the worker's own revoke does.
export async function revokeCodes(
  room: DocumentRoom,
  documentId: string,
  codes: string[],
  reason: 'revoked' | 'rescoped' = 'revoked',
): Promise<number> {
  room.bindDocument(documentId);
  let closed = 0;
  for (const code of codes) {
    const op = { kind: reason === 'rescoped' ? 'share-rescoped' : 'share-revoked', code };
    const before = openRoomSockets(room.state.getWebSockets()).length;
    room.broadcastSystemOp(op);
    closeSessionsOfChangedLink(room, op);
    await clearAgentsFor(room, op);
    closed += before - openRoomSockets(room.state.getWebSockets()).length;
  }
  return closed;
}

// Someone opened the document through a share link for the first time: the owner hears of it (email/notifications.ts
// notifyDocumentJoin), off the caller's path. A document never started has no owner to tell.
export async function joined(
  room: DocumentRoom,
  documentId: string,
  personId: string,
): Promise<void> {
  room.bindDocument(documentId);
  const env = room.requireEnv();
  const meta = await readDocumentMeta(env, documentId);
  if (!meta) return;
  room.state.waitUntil(
    notifyDocumentJoin(env, { id: documentId, ownerId: meta.ownerId, name: meta.name }, personId),
  );
}

// A closed account's name off this document (document-anonymise.ts): the index's person purge, through the api.
export async function anonymise(
  room: DocumentRoom,
  documentId: string,
  personId: string,
): Promise<number> {
  room.bindDocument(documentId);
  // A document never started (or purged) holds nothing of anyone: read its storage as it is, without making the
  // schema and document row a first query would.
  const sql = room.state.storage.sql;
  const started =
    sql.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'document'`).toArray()
      .length > 0 &&
    sql.exec('SELECT 1 FROM document WHERE id = ? AND created_at > 0', documentId).toArray()
      .length > 0;
  if (!started) return 0;
  const changed = await anonymiseDocument(room.requireEnv(), documentId, personId);
  // The owner may have been the one anonymised: the next grant reads the stored copy again.
  room.head.forget();
  if (changed > 0) console.info('[room] anonymised a closed account', { rows: changed });
  return changed;
}

// What another holder of a shared tab sent. A document with nothing stored holds no tab, and makes no schema to say
// so.
export async function receiveShares(
  room: DocumentRoom,
  documentId: string,
  from: string,
  messages: ShareMessage[],
): Promise<ShareAnswer[]> {
  const sql = room.state.storage.sql;
  if (room.documentId === null && !hasDocumentSchema((q) => sql.exec(q)))
    return messages.map(() => 'gone');
  room.bindDocument(documentId);
  return documentShares.receive(room.requireEnv(), documentId, from, messages);
}
