// liveworkspace's index (liveworkspace/docs/index-service.md): one Worker on liveworkspace.app/api/index
// holding where every Canvas, Plan, Document and Design is and who can reach it, for the One Explorer in
// every app. Browsers reach it through their own app's router; apps' servers push summaries and comments
// with their key; grants it signs let an app's item open without asking again.

import { continuePurges, FREQUENT_CRON, handlePersonPurge } from './account-purge';
import { handleApp } from './app-routes';
import { callerOf } from './auth';
import { sendDriveSignals, type DriveTouched } from './drive';
import { API_PATH, JWKS_MAX_AGE_S } from './config';
import type { PersonContext, RouteContext } from './context';
import { indexEnabled, type Env } from './env';
import { handleFolders } from './folders';
import { publicKeys } from './grants';
import { fail, forbidden, json, notFound, unauthorized } from './http';
import { handleInbox } from './inbox';
import { createItem, handleItem, handleItemList, handleTrash } from './items';
import { handleMerge } from './merge';
import { drainPersonMerges } from './person-merges';
import { handleFavourites, handlePlacementDefaults, handleRecentHidden } from './personal';
import { sweep } from './purge';
import { sweepExpiringLinks } from './share-expiry';
import { handleWorkbenchClose } from './workbench-close';
import { handleAccountTimeline, handleTimeline } from './timeline';
import { handleItemShare, handleShareCode, handleShared } from './sharing';
import { under } from '@liveworkspace/index-app/worker-http';

function splitPath(path: string): string[] | null {
  try {
    return path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
}

// The lists an app acting for a person sees filtered to that app.
const LISTS = new Set(['items', 'trash', 'shared', 'inbox', 'timeline']);

// What the Drive mirror acting for a person may reach: their items, Trash and folders (liveworkspace/docs/drive.md).
const DRIVE_ROUTES = new Set(['items', 'trash', 'folders']);

// The routes that need a person: anything listing or changing a person's own things.
const PERSON_ROUTES: Record<string, (ctx: PersonContext) => Promise<Response>> = {
  folders: handleFolders,
  favourites: handleFavourites,
  'recent-hidden': handleRecentHidden,
  'placement-defaults': handlePlacementDefaults,
  shared: handleShared,
  inbox: handleInbox,
  trash: handleTrash,
  timeline: handleTimeline,
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
    const waitUntil = (promise: Promise<unknown>) => ctx.waitUntil(promise);
    // Server to server: an app's pushes, the Drive mirror's flag, and accounts' merge. No person, no browser.
    if (segments[0] === 'app') return handleApp(request, env, segments, waitUntil);
    if (segments[0] === 'internal' && segments[1] === 'merge' && segments.length === 2) {
      return handleMerge(request, env, waitUntil);
    }
    // Accounts' team and API token events for the Timeline.
    if (segments[0] === 'internal' && segments[1] === 'timeline' && segments.length === 2) {
      return handleAccountTimeline(request, env);
    }
    if (segments[0] === 'internal' && segments[1] === 'purge-person' && segments.length === 2) {
      return handlePersonPurge(request, env, waitUntil);
    }
    // Accounts' workbench service closing the rooms a pairing's sessions joined.
    if (segments[0] === 'internal' && segments[1] === 'workbench-close' && segments.length === 2) {
      return handleWorkbenchClose(request, env);
    }
    const caller = await callerOf(request, env);
    if (caller === 'guest') return forbidden();
    if (!caller) return unauthorized();
    // An app acting for a person reaches that app's items only: its lists are that app's. The Drive mirror's
    // lists are every app's (an `app` or `apps` filter it sends still applies), its reach narrowed instead.
    const delegate = caller.person?.app;
    if (delegate && LISTS.has(segments[0] ?? '') && segments.length === 1) {
      url.searchParams.set('app', delegate);
    }
    if (caller.person?.drive) {
      const share = segments[2] === 'share' || segments[2] === 'share-password';
      if (!DRIVE_ROUTES.has(segments[0] ?? '') || (segments[0] === 'items' && share)) {
        return notFound();
      }
    }
    const drive: DriveTouched = new Set();
    const response = await route({ request, env, url, segments, caller, waitUntil, drive });
    // After the answer: the Drive mirror hears of its people's changes (nothing without its binding).
    if (drive.size > 0 && env.DRIVE) ctx.waitUntil(sendDriveSignals(env, drive));
    return response;
  },

  // Every 15 minutes: carry on closed accounts' purges, and tell the apps what was purged and which guests
  // became accounts. Once a day: move empty, unchanged items to the Trash, purge items 30 days in it, retry apps that missed a purge, and warn owners
  // of share links lapsing within the week (share-expiry.ts).
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    if (!indexEnabled(env)) return;
    if (event.cron === FREQUENT_CRON) {
      await step('purges', async () => {
        console.log('[index] purges', JSON.stringify(await continuePurges(env)));
      });
      await step('person merges', async () => {
        console.log('[index] person merges', await drainPersonMerges(env));
      });
      return;
    }
    await step('sweep', async () => {
      const { emptied, purged, confirmed } = await sweep(env);
      console.log(
        `[index] sweep: ${emptied} empty items to the Trash, purged ${purged} items, apps confirmed ${confirmed}`,
      );
    });
    await step('expiring links', async () => {
      console.log(`[index] ${await sweepExpiringLinks(env)} items with links expiring`);
    });
  },
};

// One cron step: a failure is logged and the run goes on to the next, so one broken step never starves the rest.
async function step(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error(`[index] cron step failed: ${name}`, err);
  }
}

export default worker;
