// liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md): one Worker holding every app's uploaded
// images, on liveworkspace.app/api/media, so a person's pictures follow them from app to app. It answers
// only the apps' own Workers. Each app still decides who may see a picture, from its own documents and
// shares, and serves the bytes it fetches here.
//
// It also serves every app's previews on liveworkspace.app/api/previews (liveworkspace/docs/specs/006-media/previews.md): the
// pictures of items, to browsers, behind the index's access rule.

import { API_PATH, PREVIEWS_PATH, UNUSED_IMAGE_AGE_MS } from './config';
import { mediaEnabled, type Env } from './env';
import { json, notFound } from './http';
import { sweepUnusedImages } from './retention';
import { handleSharedWalkthrough, sweepPendingWalkthroughs } from './walkthroughs';

const SHARED_WALKTHROUGHS_PATH = '/walkthroughs/shared';
import { handlePreviews } from './previews/routes';
import { handleApp } from './routes';
import { under } from '@liveworkspace/index-app/worker-http';
import { guardRequest } from '@liveworkspace/api-kit/request-failure';
import { createApiRouteLabel } from '@liveworkspace/telemetry/error-tokens';

// The route words a failure is logged under (`Get.Media.App.Images.Bytes`), never an id.
const routeLabel = createApiRouteLabel(
  new Set(['media', 'previews']),
  new Set([
    'app',
    'images',
    'bytes',
    'previews',
    'usage',
    'refs',
    'owners',
    'merge',
    'library',
    'list',
    'save',
    'place',
    'rename',
    'rename-folder',
    'delete',
    'walkthroughs',
    'media',
    'share',
    'shared',
  ]),
);

async function serve(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (under(url.pathname, PREVIEWS_PATH)) {
    if (!mediaEnabled(env)) return notFound();
    const defer = (work: Promise<unknown>) => (ctx ? ctx.waitUntil(work) : void work);
    return handlePreviews(request, env, url, url.pathname.slice(PREVIEWS_PATH.length), defer);
  }
  if (!under(url.pathname, API_PATH)) return new Response('Not found', { status: 404 });
  const path = url.pathname.slice(API_PATH.length);
  // A walkthrough's public link (no app key): the liveworkspace site's /walkthrough/<code> page reads it.
  if (mediaEnabled(env) && env.MEDIA && under(path, SHARED_WALKTHROUGHS_PATH)) {
    let segments: string[];
    try {
      segments = path
        .slice(SHARED_WALKTHROUGHS_PATH.length)
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);
    } catch {
      return notFound();
    }
    return handleSharedWalkthrough(request, env, env.MEDIA, segments);
  }
  if (!mediaEnabled(env) || !under(path, '/app')) return notFound();
  return handleApp(request, env, url, path.slice('/app'.length));
}

const worker = {
  // One guard for the whole request (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails").
  fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    return guardRequest(
      () => serve(request, env, ctx),
      () => ({ route: routeLabel(request.method, request.url), json }),
    );
  },

  // Once a day: walkthroughs whose media never arrived, then the unused-image sweep.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    if (!mediaEnabled(env)) return;
    await sweepPendingWalkthroughs(env);
    const cutoff = Date.now() - UNUSED_IMAGE_AGE_MS;
    const deleted = await sweepUnusedImages(env, cutoff);
    console.info(
      `[media] sweep: deleted ${deleted} images older than ${new Date(cutoff).toISOString()}`,
    );
  },
};

export default worker;
