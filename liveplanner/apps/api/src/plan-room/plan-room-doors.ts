// The bodies of the room's RPC doors (plan-room.ts) that do more than one read: what the worker asks of a plan
// (its routes, the Community post, the export door, copies, share links, a closed account). Each takes the room.
import {
  openRoomSockets,
  recordItemEditor,
  type ExportCommentsResult,
  type ExportQuery,
  type ExportResult,
  type ExportTablesResult,
} from '@liveworkspace/index-app';
import { getTab, planHasTab } from '../db/tabs';
import { itemIdsShownOnTab, tabShowsEveryCard } from '@liveplanner/items';
import { drawPlan } from '../thumbnail';
import { planShares, type ShareAnswer, type ShareMessage } from './tab-shares';
import { hasPlanSchema } from './plan-schema';
import { planServesImage } from './image-grants';
import { exportPlanCopy, readPlanMeta, readPlanOutline } from './plan-content';
import {
  communityCheckDueAt,
  communityPostAuthor,
  openCommunityCode,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import type { CommunityLink, CommunityListing, CopySource } from '../plan-client';
import type { Copier } from '@liveworkspace/index-app';
import { notifyProjectJoin } from '../email/notifications';
import { anonymisePlan } from './plan-anonymise';
import { PLAN_OUTBOX } from './plan-outbox';
import { exportProjectFile } from './project-file';
import { addConnectedPlanTab, connectedTabArrival } from './connected-tab';
import type { ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import { exportPlanComments, exportPlanTables } from './plan-export';
import { answerPlanRequest, isPlanCreate, type RouteIdentity } from './plan-route';
import type { PlanRoom } from './plan-room';
import { ensureSchema, noteWrite } from './plan-room-content';
import { closeSessionsOfChangedLink } from './plan-room-sockets';
import { clearAgentsFor } from './plan-room-presence';

// What the export door answers a drawing as.
const SVG_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

export async function route(
  room: PlanRoom,
  planId: string,
  request: Request,
  identity: RouteIdentity,
): Promise<Response> {
  room.bindPlan(planId);
  const env = room.requireEnv();
  if (identity.grant?.item === planId) await room.takeHead(identity.grant);
  const community = await communityOf(room, planId);
  const writesBefore = room.writes;
  const response = await answerPlanRequest(
    env,
    request,
    identity,
    (p) => room.state.waitUntil(p),
    community,
  );
  // A request that wrote is an edit by whoever asked: their Timeline entry and a Most Used day
  // (@liveworkspace/index-app recordItemEditor). Reads, refusals and requests that changed nothing are not, nor is
  // the create, the plan's making (isPlanCreate).
  if (response.ok && identity.owner && room.writes > writesBefore) {
    if (!isPlanCreate(request)) {
      const sql = room.state.storage.sql;
      recordItemEditor(
        (q, ...b) => sql.exec(q, ...b),
        PLAN_OUTBOX,
        planId,
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
export async function communityOf(room: PlanRoom, planId: string): Promise<CommunityLink | null> {
  if (!room.storedSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post) return null;
  const meta = await readPlanMeta(env, planId);
  return { code: post.shareCode, open: openCommunityCode(env, post, meta) === post.shareCode };
}

// The post when `code` is its link and it opens the plan now; null otherwise.
export async function openPost(
  room: PlanRoom,
  planId: string,
  code: string,
): Promise<CommunityPost | null> {
  room.bindPlan(planId);
  if (!room.storedSchema()) return null;
  const env = room.requireEnv();
  const post = await readCommunityPost(env);
  if (!post || post.shareCode !== code) return null;
  const meta = await readPlanMeta(env, planId);
  return openCommunityCode(env, post, meta) === code ? post : null;
}

// What a visitor through the plan's Community post's open link is told of the post (docs/specs/025-community/
// community.md "Viewing a post's plan"): its id at the service and who it shows as author.
export async function communityListing(
  room: PlanRoom,
  planId: string,
  code: string,
): Promise<CommunityListing | null> {
  const post = await openPost(room, planId, code);
  if (!post) return null;
  return { postId: post.postId, author: await communityPostAuthor(room.requireEnv(), post) };
}

// A copy through the plan's Community post's link is named after the post (docs/specs/025-community/community.md
// "Viewing a post's plan"): its title, when `code` is the post's open link. Null otherwise.
export async function communityPostTitle(
  room: PlanRoom,
  planId: string,
  code: string,
): Promise<string | null> {
  return (await openPost(room, planId, code))?.title ?? null;
}

// The export door (liveworkspace/docs/specs/006-media/previews.md, routes/internal-items.ts): the plan drawn as an SVG, the first
// tab or one, with its last save as the version. Unchanged since `ifVersion`, it is not drawn. A plan never
// started is not found, and asking does not start it.
export async function exportImage(
  room: PlanRoom,
  planId: string,
  query: ExportQuery,
): Promise<ExportResult> {
  const sql = room.state.storage.sql;
  if (room.planId === null && !hasPlanSchema((q) => sql.exec(q))) return { status: 'not_found' };
  room.bindPlan(planId);
  const env = room.requireEnv();
  const { meta, savedAt, itemTypes } = await readPlanOutline(env, planId);
  if (!meta) return { status: 'not_found' };
  // Through the plan's Community post's link it is the redacted drawing, and nothing while the post does not open
  // the plan (docs/specs/025-community/community.md "Viewing a post's plan").
  let community = false;
  if (query.code !== null) {
    const post = await readCommunityPost(env);
    if (post?.shareCode === query.code) {
      if (openCommunityCode(env, post, meta) !== query.code) return { status: 'not_found' };
      community = true;
    }
  }
  if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
  if (query.tabId !== null && !(await planHasTab(env, planId, query.tabId))) {
    return { status: 'not_found' };
  }
  const svg = await drawPlan(env, { id: planId, name: meta.name, itemTypes }, query.tabId, {
    defer: (p) => room.state.waitUntil(p),
    community,
  });
  return svg === null
    ? { status: 'empty', version: savedAt }
    : { status: 'ok', body: svg, contentType: SVG_CONTENT_TYPE, version: savedAt };
}

// The export door's `file` format (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps", project-file.ts): the
// plan's whole envelope, its last save as the version, unread when the caller holds that save. A plan never
// started is not found, and asking does not start it.
export async function exportFile(
  room: PlanRoom,
  planId: string,
  query: ExportQuery,
): Promise<ExportResult> {
  const sql = room.state.storage.sql;
  if (room.planId === null && !hasPlanSchema((q) => sql.exec(q))) return { status: 'not_found' };
  room.bindPlan(planId);
  return exportProjectFile(room.requireEnv(), planId, query.ifVersion);
}

export async function exportComments(
  room: PlanRoom,
  planId: string,
): Promise<ExportCommentsResult> {
  const sql = room.state.storage.sql;
  if (room.planId === null && !hasPlanSchema((q) => sql.exec(q))) return { status: 'not_found' };
  room.bindPlan(planId);
  return exportPlanComments(room.requireEnv(), planId);
}

// The index's reverse write of a connected tab (connected-tab.ts): appended at the end of the tab bar, and everyone
// with the plan open sees it arrive, as an ordered system op a blipped socket replays. A plan never started is not
// found, and asking does not start it.
export async function addConnectedTab(
  room: PlanRoom,
  planId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  const sql = room.state.storage.sql;
  if (room.planId === null && !hasPlanSchema((q) => sql.exec(q))) return 'not_found';
  room.bindPlan(planId);
  const env = room.requireEnv();
  const outcome = await addConnectedPlanTab(env, planId, write);
  if (typeof outcome === 'object' && outcome.made) {
    const op = await connectedTabArrival(env, planId);
    if (op) room.broadcastOrderedSystemOp(op);
  }
  return outcome;
}

// A plan never started serves nothing, and asking does not start it. A tab-scoped reader (`tabScope`) reads a
// picture only through a card its tab shows (docs/specs/026-plan/items.md "Who sees the bytes"): a tab with a board
// or plan view shows every card, any other only the cards its Plan cards point at, and a tab the plan doesn't hold
// serves nothing.
export async function servesImage(
  room: PlanRoom,
  planId: string,
  imageId: string,
  tabScope: string | null = null,
): Promise<boolean> {
  const sql = room.state.storage.sql;
  if (room.planId === null && !hasPlanSchema((q) => sql.exec(q))) return false;
  room.bindPlan(planId);
  ensureSchema(room);
  let onlyCards: string[] | null = null;
  if (tabScope !== null) {
    const tab = await getTab(room.requireEnv(), planId, tabScope);
    if (!tab) return false;
    if (!tabShowsEveryCard(tab.elements)) onlyCards = [...itemIdsShownOnTab(tab.elements, [])];
  }
  return planServesImage(sql, planId, imageId, onlyCards);
}

// The source side of a copy (plan-content.ts exportPlanCopy); a copy through the plan's open Community post's link
// takes it as the link shows it (docs/specs/025-community/community.md). `community` says which, so the copy is
// counted toward the post.
export async function exportCopy(
  room: PlanRoom,
  planId: string,
  onlyTabId: string | null,
  copier: Copier | null,
): Promise<CopySource | null> {
  room.bindPlan(planId);
  const env = room.requireEnv();
  const post = copier?.code ? await communityOf(room, planId) : null;
  const community = post !== null && post.open && post.code === copier?.code;
  const copy = await exportPlanCopy(env, planId, onlyTabId, null, community);
  return copy ? { copy, community } : null;
}

// Share links the index revoked: each one's sessions hear it and end now, as the worker's own revoke does.
export async function revokeCodes(
  room: PlanRoom,
  planId: string,
  codes: string[],
  reason: 'revoked' | 'rescoped' = 'revoked',
): Promise<number> {
  room.bindPlan(planId);
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

// Someone opened the plan through a share link for the first time: the owner hears of it (email/notifications.ts
// notifyProjectJoin), off the caller's path. A plan never started has no owner to tell.
export async function joined(room: PlanRoom, planId: string, personId: string): Promise<void> {
  room.bindPlan(planId);
  const env = room.requireEnv();
  const meta = await readPlanMeta(env, planId);
  if (!meta) return;
  room.state.waitUntil(
    notifyProjectJoin(env, { id: planId, ownerId: meta.ownerId, name: meta.name }, personId),
  );
}

// A closed account's name off this plan (plan-anonymise.ts): the index's person purge, through the api.
export async function anonymise(room: PlanRoom, planId: string, personId: string): Promise<number> {
  room.bindPlan(planId);
  // A plan never started (or purged) holds nothing of anyone: read its storage as it is, without making the
  // schema and plan row a first query would.
  const sql = room.state.storage.sql;
  const started =
    sql.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'plan'`).toArray()
      .length > 0 &&
    sql.exec('SELECT 1 FROM plan WHERE id = ? AND created_at > 0', planId).toArray().length > 0;
  if (!started) return 0;
  const changed = await anonymisePlan(room.requireEnv(), planId, personId);
  // The owner may have been the one anonymised: the next grant reads the stored copy again.
  room.head.forget();
  if (changed > 0) console.info('[room] anonymised a closed account', { rows: changed });
  return changed;
}

// What another holder of a shared tab sent. A plan with nothing stored holds no tab, and makes no schema to say
// so.
export async function receiveShares(
  room: PlanRoom,
  planId: string,
  from: string,
  messages: ShareMessage[],
): Promise<ShareAnswer[]> {
  const sql = room.state.storage.sql;
  if (room.planId === null && !hasPlanSchema((q) => sql.exec(q))) return messages.map(() => 'gone');
  room.bindPlan(planId);
  return planShares.receive(room.requireEnv(), planId, from, messages);
}

// The export door's `csv` and `comments` formats (liveworkspace/docs/specs/003-accounts/data-export.md,
// plan-export.ts): every board and Sheet as CSV, and every comment thread with its real authors. A plan never
// started is not found, and asking does not start it.
export async function exportTables(room: PlanRoom, planId: string): Promise<ExportTablesResult> {
  const sql = room.state.storage.sql;
  if (room.planId === null && !hasPlanSchema((q) => sql.exec(q))) return { status: 'not_found' };
  room.bindPlan(planId);
  return exportPlanTables(room.requireEnv(), planId);
}
