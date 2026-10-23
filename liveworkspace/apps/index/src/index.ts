// liveworkspace's index (liveworkspace/docs/index-service.md): one Worker on liveworkspace.app/api/index
// holding where every Canvas, Plan, Document and Design is and who can reach it, for the One Explorer in
// every app. Browsers reach it through their own app's router; apps' servers push summaries and comments
// with their key; grants it signs let an app's item open without asking again.

import { handleApp } from './app-routes';
import { callerOf } from './auth';
import { API_PATH, JWKS_MAX_AGE_S } from './config';
import type { PersonContext, RouteContext } from './context';
import { indexEnabled, type Env } from './env';
import { handleFolders } from './folders';
import { publicKeys } from './grants';
import { fail, json, notFound, unauthorized } from './http';
import { handleInbox } from './inbox';
import { createItem, handleItem, handleItemList, handleTrash } from './items';
import { handleMerge } from './merge';
import { handleFavourites, handlePlacementDefaults, handleTags } from './personal';
import { sweep } from './purge';
import { handleItemShare, handleShareCode, handleShared } from './sharing';

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

function splitPath(path: string): string[] | null {
  try {
    return path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
}

// The routes that need a person: anything listing or changing a person's own things.
const PERSON_ROUTES: Record<string, (ctx: PersonContext) => Promise<Response>> = {
  folders: handleFolders,
  tags: handleTags,
  favourites: handleFavourites,
  'placement-defaults': handlePlacementDefaults,
  shared: handleShared,
  inbox: handleInbox,
  trash: handleTrash,
};

async function route(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  const head = segments[0];
  const method = request.method;

  if (head === 'jwks' && segments.length === 1 && method === 'GET') {
    const keys = await publicKeys(env);
    if (!keys) return fail(503, 'grants_unavailable');
    return json(keys, { headers: { 'Cache-Control': `public, max-age=${JWKS_MAX_AGE_S}` } });
  }
  if (head === 'share' && segments.length >= 2) return handleShareCode(ctx);

  if (head === 'items') {
    const id = segments[1];
    if (!id) {
      const person = ctx.caller.person;
      if (!person) return unauthorized();
      if (method === 'GET') return handleItemList({ ...ctx, person });
      if (method === 'POST') return createItem({ ...ctx, person });
      return notFound();
    }
    if (segments[2] === 'share' || segments[2] === 'share-password') {
      return segments.length === 3 ? handleItemShare(ctx, id) : notFound();
    }
    return handleItem(ctx, id);
  }

  const handler = head ? PERSON_ROUTES[head] : undefined;
  if (handler) {
    const person = ctx.caller.person;
    if (!person) return unauthorized();
    return handler({ ...ctx, person });
  }
  return notFound();
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!under(url.pathname, API_PATH)) return new Response('Not found', { status: 404 });
    if (!indexEnabled(env)) return notFound();
    const segments = splitPath(url.pathname.slice(API_PATH.length));
    if (!segments) return notFound();
    // Server to server: an app's pushes, and accounts' merge. No person, no browser.
    if (segments[0] === 'app') return handleApp(request, env, segments);
    if (segments[0] === 'internal' && segments[1] === 'merge' && segments.length === 2) {
      return handleMerge(request, env);
    }
    const caller = await callerOf(request, env);
    return route({
      request,
      env,
      url,
      segments,
      caller,
      waitUntil: (promise) => ctx.waitUntil(promise),
    });
  },

  // Once a day: purge items 30 days in the Trash, and retry apps that missed a purge.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    if (!indexEnabled(env)) return;
    const { purged, confirmed } = await sweep(env);
    console.log(`[index] sweep: purged ${purged} items, apps confirmed ${confirmed}`);
  },
};

export default worker;
