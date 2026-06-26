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

// Fetch + parse JSON, throwing ApiError on a non-2xx so tools surface a clear,
// model-correctable message.
export async function apiJson<T>(
  env: Env,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(env, token, path, init);
  if (!res.ok) throw new ApiError(res.status, (await res.text().catch(() => '')).slice(0, 500));
  return (await res.json()) as T;
}
