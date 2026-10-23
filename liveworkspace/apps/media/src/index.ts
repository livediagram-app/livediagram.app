// liveworkspace's media service (liveworkspace/docs/media.md): one Worker holding every app's uploaded
// images, on liveworkspace.app/api/media, so a person's pictures follow them from app to app. It answers
// only the apps' own Workers. Each app still decides who may see a picture, from its own documents and
// shares, and serves the bytes it fetches here.

import { API_PATH, UNUSED_IMAGE_AGE_MS } from './config';
import { mediaEnabled, type Env } from './env';
import { notFound } from './http';
import { sweepUnusedImages } from './retention';
import { handleApp } from './routes';

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!under(url.pathname, API_PATH)) return new Response('Not found', { status: 404 });
    const path = url.pathname.slice(API_PATH.length);
    if (!mediaEnabled(env) || !under(path, '/app')) return notFound();
    return handleApp(request, env, url, path.slice('/app'.length));
  },

  // Once a day: the unused-image sweep.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    if (!mediaEnabled(env)) return;
    const cutoff = Date.now() - UNUSED_IMAGE_AGE_MS;
    const deleted = await sweepUnusedImages(env, cutoff);
    console.log(
      `[media] sweep: deleted ${deleted} images older than ${new Date(cutoff).toISOString()}`,
    );
  },
};

export default worker;
