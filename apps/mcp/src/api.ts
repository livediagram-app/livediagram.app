// Thin client for the api worker over the service binding (spec/62 §2). Every
// call forwards the caller's Bearer lvd_ token; the api resolves it to the
// owning account and applies the SAME authorization every route already
// enforces, so the MCP needs no special privilege and adds no business logic.
import type { Env } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`api ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

// Service-binding requests ignore the host; the path is what the api routes on
// (it dispatches on the segment after `/api`). A stable internal host keeps
// logs readable.
function apiUrl(path: string): string {
  return `https://livediagram-api/api${path}`;
}

export async function apiFetch(
  env: Env,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return env.API.fetch(new Request(apiUrl(path), { ...init, headers }));
}

// Fire-and-forget anonymous telemetry to the api's public /api/events (spec/22).
// No token: the ingest endpoint is unauthenticated and only stores the closed
// three-field vocabulary. Never awaited and never throws into the tool; a
// worker-to-worker call sends no Origin header, so the same-origin guard
// passes. Off unless the api has TELEMETRY_ENABLED.
export function postTelemetry(env: Env, category: string, action: string, type: string): void {
  void env.API.fetch(
    new Request(apiUrl('/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [{ category, action, type }] }),
    }),
  ).catch(() => {});
}

// Fetch + parse JSON, throwing ApiError on a non-2xx so tools surface a clear,
// model-correctable message. A genuine failure — the api worker 5xx'd, or the
// request never completed — is reported to the Error telemetry category
// (spec/62 §4.12) so the public Exceptions dashboard shows where the MCP
// breaks. A 4xx is NOT reported: it's expected model-correctable input (a bad
// id, malformed elements), not a fault, and would only flood the dashboard.
export async function apiJson<T>(
  env: Env,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(env, token, path, init);
  } catch (err) {
    // The request never completed (service binding down, network fault): a real
    // failure, not model-correctable. Report as an internal error, then rethrow.
    postTelemetry(env, 'Error', 'Api', 'Internal');
    throw err;
  }
  if (!res.ok) {
    if (res.status >= 500) postTelemetry(env, 'Error', 'Api', `Http${res.status}`);
    throw new ApiError(res.status, (await res.text().catch(() => '')).slice(0, 500));
  }
  return (await res.json()) as T;
}
