// Small pieces every liveworkspace service Worker answers with (index, media, Community, telemetry), kept once.

/** Whether `pathname` is `base` itself or anything under it (`/api/media` and `/api/media/…`, never `/api/mediax`). */
export const under = (pathname: string, base: string): boolean =>
  pathname === base || pathname.startsWith(`${base}/`);

/** A JSON answer: the body as JSON, with the init's status and headers. */
export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

/** Whether a page's Origin is this machine's (a development server). */
export function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}
