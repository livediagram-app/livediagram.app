// The component library over REST (docs/specs/009-elements/components.md "Sharing, collaboration and storage";
// docs/specs/015-api/api.md):
//   GET   /api/designs/<id>/components                 the mains the caller may see
//   PUT   /api/designs/<id>/components/<componentId>   make (or replace) one main
//   PATCH /api/designs/<id>/components/<componentId>   change one main, element by element
// Writes need an edit grant (a tab-scoped Editor too, on a main no other tab draws); API tokens may write here, as
// agents patch mains. Each stored write is announced to the room as a `component` system op.

import {
  applyComponentPatch,
  componentWithinBytes,
  isValidComponentPatch,
  isValidDesignComponent,
  type DesignComponent,
} from '@livedesign/design';
import type { ComponentResponse, ComponentsResponse } from '@livedesign/api-schema';
import { redactCommentAuthorIds } from '../comments';
import { mainsForReader } from '../component-redact';
import { readDesignMeta, type DesignMeta } from '../design-room/design-content';
import {
  componentTabIds,
  componentUsedOutside,
  putComponent,
  readComponentRow,
  readComponents,
  swapComponent,
  touchDesignSaved,
} from '../db/components';
import { badRequest, conflict, forbidden, json, notFound, payloadTooLarge } from '../responses';
import { relayComponent } from '../room-client';
import {
  COMMUNITY_CONTENT,
  gateEdit,
  gateGrant,
  grantOn,
  missingDesign,
  readBody,
  requireOwner,
  type DesignAccess,
  type DesignRouteContext,
} from './context';

// A patch's read-modify-write, retried when another write landed between its read and its swap.
const PATCH_ATTEMPTS = 3;

/** Null when the path is not a component route. */
export async function handleComponentRoutes(ctx: DesignRouteContext): Promise<Response | null> {
  const { request, segments } = ctx;
  if (segments[1] !== 'designs' || segments[3] !== 'components') return null;
  const list = segments.length === 4 && request.method === 'GET';
  const put = segments.length === 5 && request.method === 'PUT';
  const patch = segments.length === 5 && request.method === 'PATCH';
  if (!list && !put && !patch) return null;
  const id = segments[2]!;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const meta = await readDesignMeta(ctx.env, id);
  if (!meta) return missingDesign(ctx, id);
  if (list) return handleList(ctx, id, meta, owner);
  // An edit grant, design-wide or confined to one tab (that tab names itself as the one the write is about).
  const grant = grantOn(ctx, id);
  if (!(await gateEdit(ctx, id, meta.ownerId, meta.teamId, grant?.tabScope ?? undefined))) {
    return forbidden();
  }
  const writer: Writer = { designId: id, componentId: segments[4]!, meta, owner, grant: grant! };
  return put ? handlePut(ctx, writer) : handlePatch(ctx, writer);
}

type Writer = {
  designId: string;
  componentId: string;
  meta: DesignMeta;
  owner: string;
  grant: DesignAccess;
};

async function handleList(
  ctx: DesignRouteContext,
  id: string,
  meta: DesignMeta,
  owner: string,
): Promise<Response> {
  // Instances draw for every reader, a Community visitor's too.
  const grant = await gateGrant(ctx, id, meta.ownerId, meta.teamId, COMMUNITY_CONTENT);
  if (!grant) return notFound();
  // A tab-scoped link reads only the mains its tab uses (docs/specs/013-workspace/tab-scoped-share-links.md).
  const mains = await readComponents(
    ctx.env,
    grant.tabScope === null ? {} : { tabIds: [grant.tabScope] },
  );
  const body: ComponentsResponse = { components: forReader(mains, grant, owner, meta) };
  return json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}

async function handlePut(ctx: DesignRouteContext, w: Writer): Promise<Response> {
  const read = await readBody(ctx);
  if (read instanceof Response) return read;
  const stored = await readComponentRow(ctx.env, w.componentId);
  if (stored && (await outOfScope(ctx, w))) return forbidden();
  const main: Record<string, unknown> = { ...read, updatedAt: stampAfter(stored?.main) };
  if (!isValidDesignComponent(main) || main.id !== w.componentId) {
    return badRequest('invalid component');
  }
  if (!componentWithinBytes(main)) return payloadTooLarge();
  if (!(await putComponent(ctx.env, main))) return conflict('too_many_components');
  return answerStored(ctx, w, main);
}

async function handlePatch(ctx: DesignRouteContext, w: Writer): Promise<Response> {
  const read = await readBody(ctx);
  if (read instanceof Response) return read;
  if (!isValidComponentPatch(read)) return badRequest('invalid patch');
  // A main no other tab draws is the only kind a tab-scoped Editor changes; any other reads as missing to it.
  if (await outOfScope(ctx, w)) return notFound();
  for (let attempt = 0; attempt < PATCH_ATTEMPTS; attempt += 1) {
    const stored = await readComponentRow(ctx.env, w.componentId);
    if (!stored) return notFound();
    const next = applyComponentPatch(stored.main, read, stampAfter(stored.main));
    if (!isValidDesignComponent(next)) return badRequest('invalid component');
    if (!componentWithinBytes(next)) return payloadTooLarge();
    if (await swapComponent(ctx.env, next, stored.data)) return answerStored(ctx, w, next);
  }
  console.warn('[components] patch-contended', {
    designId: w.designId,
    componentId: w.componentId,
  });
  return conflict('component_busy');
}

// After a stored write: the design's last save moves (its preview, Drive file and listing follow), the room hears the
// main with the tabs that use it, and the writer gets it back as stored.
async function answerStored(
  ctx: DesignRouteContext,
  w: Writer,
  main: DesignComponent,
): Promise<Response> {
  await touchDesignSaved(ctx.env, w.designId, Date.now());
  const tabIds = await componentTabIds(ctx.env, main.id);
  // Comment author ids never reach the room (as opForTheWire strips them from every other op).
  const wire = { ...main, elements: redactCommentAuthorIds(main.elements, null) };
  await relayComponent(ctx.env, w.designId, { kind: 'component', component: wire, tabIds });
  const body: ComponentResponse = { component: forReader([main], w.grant, w.owner, w.meta)[0]! };
  return json(body);
}

// A tab-scoped writer asking about a main some other tab draws.
async function outOfScope(ctx: DesignRouteContext, w: Writer): Promise<boolean> {
  const scope = w.grant.tabScope;
  return scope !== null && (await componentUsedOutside(ctx.env, w.componentId, scope));
}

// The time a write stores: now, or just after the stored main's when the clock is behind it, so a later write always
// carries the later `updatedAt` (what a shared tab's take and an editor compare).
function stampAfter(main: DesignComponent | undefined): number {
  const now = Date.now();
  return main && main.updatedAt >= now ? main.updatedAt + 1 : now;
}

function forReader(
  mains: readonly DesignComponent[],
  grant: DesignAccess,
  owner: string,
  meta: DesignMeta,
): DesignComponent[] {
  return mainsForReader(mains, {
    community: grant.community,
    redactFor: owner === meta.ownerId ? null : owner,
  });
}
