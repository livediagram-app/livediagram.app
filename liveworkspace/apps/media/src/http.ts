// Responses for the media API (liveworkspace/docs/media.md "The API"). Every route is server to
// server, so there is no CORS: a browser is never let in.

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const ok = () => json({ ok: true });
export const notFound = () => json({ error: 'not_found' }, { status: 404 });
export const badRequest = (error: string) => json({ error }, { status: 400 });
export const forbidden = () => json({ error: 'forbidden' }, { status: 403 });
export const unauthorized = () => json({ error: 'unauthorized' }, { status: 401 });
export const unavailable = () => json({ error: 'media_unavailable' }, { status: 503 });
