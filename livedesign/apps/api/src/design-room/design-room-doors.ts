// The bodies of the room's RPC doors (design-room.ts) that do more than one read: what the worker asks of a design
// (its routes, the Community post, the export door, copies, share links, a closed account). Each takes the room.
import { openRoomSockets, recordItemEditor } from '@liveworkspace/index-app';
import { designServesImage } from '../db/image-grants';
import { designHasTab } from '../db/tabs';
import { drawDesign } from '../thumbnail';
import type { ExportCommentsResult, ExportQuery, ExportResult } from '@liveworkspace/index-app';
import { designShares, type ShareAnswer, type ShareMessage } from './tab-shares';
import { hasDesignSchema } from './design-schema';
import { exportDesignCopy, readDesignMeta, readDesignHead } from './design-content';
import {
  communityCheckDueAt,
  communityPostAuthor,
  openCommunityCode,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import type { CommunityListing, CopySource } from '../design-client';
import type { Copier } from '@liveworkspace/index-app';
import { notifyDesignJoin } from '../email/notifications';
import { anonymiseDesign } from './design-anonymise';
import { DESIGN_OUTBOX } from './design-outbox';
import { exportDesignFile } from './design-file';
import { addConnectedDesignTab, connectedTabArrival } from './connected-tab';
import type { ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import { exportDesignComments } from './design-comments';
import { answerDesignRequest, isDesignCreate, type RouteIdentity } from './design-route';
import type { DesignRoom } from './design-room';
import { noteWrite } from './design-room-content';
import { closeSessionsOfChangedLink, sequenceMutation } from './design-room-sockets';
import { clearAgentsFor } from './design-room-presence';

// What the export door answers a drawing as.
const SVG_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

export async function route(
  room: DesignRoom,
  designId: string,
  request: Request,
  identity: RouteIdentity,
): Promise<Response> {
  room.bindDesign(designId);
  const env = room.requireEnv();
  // Before the write counter is read: taking the owner and team is no edit.
  if (identity.grant?.item === designId) await room.takeHead(identity.grant);
  const community = await communityOf(room, designId);
  const writesBefore = room.writes;
  const response = await answerDesignRequest(
    env,
    request,
    identity,
    (p) => room.state.waitUntil(p),
    community,
  );
  // A request that wrote is an edit by whoever asked: their Timeline entry and a Most Used day
  // (@liveworkspace/index-app recordItemEditor). Reads, refusals and requests that changed nothing are not, nor is
  // the create, the design's making (isDesignCreate).
  if (response.ok && identity.owner && room.writes > writesBefore) {
    if (!isDesignCreate(request)) {
      const sql = room.state.storage.sql;
      recordItemEditor(
        (q, ...b) => sql.exec(q, ...b),
        DESIGN_OUTBOX,
        designId,
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
  room: DesignRoom,
  designId: string,
): Promise<{ code: string; open: boolean } | null> {
  if (!room.storedSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post) return null;
  const meta = await readDesignMeta(env, designId);
  return { code: post.shareCode, open: openCommunityCode(env, post, meta) === post.shareCode };
}

// The post when `code` is its link and it opens the design now; null otherwise.
export async function openPost(
  room: DesignRoom,
  designId: string,
  code: string,
): Promise<CommunityPost | null> {
  room.bindDesign(designId);
  if (!room.storedSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post || post.shareCode !== code) return null;
  const meta = await readDesignMeta(env, designId);
  return openCommunityCode(env, post, meta) === code ? post : null;
}

// What a visitor through the design's Community post's open link is told of the post (docs/specs/025-community/
// community.md "Viewing a post's design"): its id at the service and who it shows as author.
export async function communityListing(
  room: DesignRoom,
  designId: string,
  code: string,
): Promise<CommunityListing | null> {
  const post = await openPost(room, designId, code);
  if (!post) return null;
  return { postId: post.postId, author: await communityPostAuthor(room.requireEnv(), post) };
}

// A copy through the design's Community post's link is named after the post (docs/specs/025-community/
// community.md "Viewing a post's design"): its title, when `code` is the post's open link. Null otherwise.
export async function communityPostTitle(
  room: DesignRoom,
  designId: string,
  code: string,
): Promise<string | null> {
  return (await openPost(room, designId, code))?.title ?? null;
}

// The design drawn for liveworkspace's previews (liveworkspace/docs/specs/006-media/previews.md "The export door"): the first tab or
// the one asked for, versioned by its last save. Stores nothing; the platform keeps and serves the picture.
export async function exportImage(
  room: DesignRoom,
  designId: string,
  query: ExportQuery,
): Promise<ExportResult> {
  room.bindDesign(designId);
  // A design this object never held: nothing to draw, and no schema made just to say so.
  const sql = room.state.storage.sql;
  if (!hasDesignSchema((q) => sql.exec(q))) return { status: 'not_found' };
  const env = room.requireEnv();
  const { meta, savedAt } = await readDesignHead(env, designId);
  if (!meta) return { status: 'not_found' };
  // Through the design's Community post's link it is the redacted drawing, and nothing while the post does not
  // open the design (docs/specs/025-community/community.md "Viewing a post's design").
  let community = false;
  if (query.code !== null) {
    const post = await readCommunityPost(env);
    if (post?.shareCode === query.code) {
      if (openCommunityCode(env, post, meta) !== query.code) return { status: 'not_found' };
      community = true;
    }
  }
  if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
  if (query.tabId !== null && !(await designHasTab(env, designId, query.tabId))) {
    return { status: 'not_found' };
  }
  const svg = await drawDesign(env, { id: designId, name: meta.name }, query.tabId, {
    defer: (p) => room.state.waitUntil(p),
    community,
  });
  return svg === null
    ? { status: 'empty', version: savedAt }
    : { status: 'ok', body: svg, contentType: SVG_CONTENT_TYPE, version: savedAt };
}

// The export door's `file` format (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps", design-file.ts): the
// design's whole envelope, its last save as the version, unread when the caller holds that save.
export async function exportFile(
  room: DesignRoom,
  designId: string,
  query: ExportQuery,
): Promise<ExportResult> {
  room.bindDesign(designId);
  const sql = room.state.storage.sql;
  if (!hasDesignSchema((q) => sql.exec(q))) return { status: 'not_found' };
  return exportDesignFile(room.requireEnv(), designId, query.ifVersion);
}

// The export door's `comments` format (liveworkspace/docs/specs/003-accounts/data-export.md "The apps' doors",
// design-comments.ts): every thread in the design with its real authors, for the data export. A design never started
// is not found, and asking does not start it.
export async function exportComments(
  room: DesignRoom,
  designId: string,
): Promise<ExportCommentsResult> {
  room.bindDesign(designId);
  const sql = room.state.storage.sql;
  if (!hasDesignSchema((q) => sql.exec(q))) return { status: 'not_found' };
  return exportDesignComments(room.requireEnv(), designId);
}

// The index's reverse write of a connected tab (connected-tab.ts): appended at the end of the tab bar, and everyone
// with the design open sees it arrive, as an ordered system op a blipped socket replays.
export async function addConnectedTab(
  room: DesignRoom,
  designId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  room.bindDesign(designId);
  const sql = room.state.storage.sql;
  if (!hasDesignSchema((q) => sql.exec(q))) return 'not_found';
  const env = room.requireEnv();
  const outcome = await addConnectedDesignTab(env, designId, write);
  if (typeof outcome === 'object' && outcome.made) {
    const op = await connectedTabArrival(env, designId);
    if (op) sequenceMutation(room, 'system', op);
  }
  return outcome;
}

export async function servesImage(
  room: DesignRoom,
  designId: string,
  imageId: string,
  onlyTabId: string | null,
): Promise<boolean> {
  room.bindDesign(designId);
  return designServesImage(room.requireEnv(), designId, imageId, onlyTabId);
}

// The source side of a copy, for whoever copies (design-content.ts exportDesignCopy): anyone but the owner takes
// the comments as the tab read serves them to them; a copy through the design's open Community post's link takes it
// without its comments or the people on its actions (docs/specs/025-community/community.md). `community` says
// which, so the copy is counted toward the post.
export async function exportCopy(
  room: DesignRoom,
  designId: string,
  onlyTabId: string | null,
  copier: Copier | null,
): Promise<CopySource | null> {
  room.bindDesign(designId);
  const env = room.requireEnv();
  const post = copier?.code ? await communityOf(room, designId) : null;
  const community = post !== null && post.open && post.code === copier?.code;
  const copy = await exportDesignCopy(env, designId, onlyTabId, copier?.by ?? null, community);
  return copy ? { copy, community } : null;
}

// Share links the index revoked: each one's sessions hear it and end now, as the worker's own revoke does.
export async function revokeCodes(
  room: DesignRoom,
  designId: string,
  codes: string[],
  reason: 'revoked' | 'rescoped' = 'revoked',
): Promise<number> {
  room.bindDesign(designId);
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

// Someone opened the design through a share link for the first time: the owner hears of it (email/notifications.ts
// notifyDesignJoin), off the caller's path. A design never started has no owner to tell.
export async function joined(room: DesignRoom, designId: string, personId: string): Promise<void> {
  room.bindDesign(designId);
  const env = room.requireEnv();
  const meta = await readDesignMeta(env, designId);
  if (!meta) return;
  room.state.waitUntil(
    notifyDesignJoin(env, { id: designId, ownerId: meta.ownerId, name: meta.name }, personId),
  );
}

// A closed account's name off this design (design-anonymise.ts): the index's person purge, through the api.
export async function anonymise(
  room: DesignRoom,
  designId: string,
  personId: string,
): Promise<number> {
  room.bindDesign(designId);
  // A design never started (or purged) holds nothing of anyone: read its storage as it is, without making the
  // schema and design row a first query would.
  const sql = room.state.storage.sql;
  const started =
    sql.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'design'`).toArray()
      .length > 0 &&
    sql.exec('SELECT 1 FROM design WHERE id = ? AND created_at > 0', designId).toArray().length > 0;
  if (!started) return 0;
  const changed = await anonymiseDesign(room.requireEnv(), designId, personId);
  // The owner may have been the one anonymised: the next grant reads the stored copy again.
  room.head.forget();
  if (changed > 0) console.info('[room] anonymised a closed account', { rows: changed });
  return changed;
}

// What another holder of a shared tab sent. A design with nothing stored holds no tab, and makes no schema to say
// so.
export async function receiveShares(
  room: DesignRoom,
  designId: string,
  from: string,
  messages: ShareMessage[],
): Promise<ShareAnswer[]> {
  const sql = room.state.storage.sql;
  if (room.designId === null && !hasDesignSchema((q) => sql.exec(q)))
    return messages.map(() => 'gone');
  room.bindDesign(designId);
  return designShares.receive(room.requireEnv(), designId, from, messages);
}
