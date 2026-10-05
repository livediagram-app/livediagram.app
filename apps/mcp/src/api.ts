// Thin client for the api worker over the service binding (docs/specs/015-api/mcp-server.md §2), over the
// shared `@livediagram/api-client`. Every call forwards the caller's Bearer lvd_ token; the api resolves it
// to the owning account and applies the SAME authorization every route already enforces, so the MCP needs
// no special privilege and adds no business logic.
import { ApiError, createApiClient, postEvents, type ApiClient } from '@livediagram/api-client';
import { errorTypeToken } from '@livediagram/api-schema';
import type { Env } from './env';
import { keepAlive } from './request-scope';
import { currentTool } from './tool-scope';

export { ApiError };

// Service-binding requests ignore the host; the path is what the api routes on (it dispatches on the
// segment after `/api`). A stable internal host keeps logs readable.
const API_BASE = 'https://livediagram-api/api';

// The client for one caller: their token, and failures reported as the running tool's (docs/specs/015-api/mcp-server.md §4.12).
export function clientFor(env: Env, token: string): ApiClient {
  return createApiClient({
    baseUrl: API_BASE,
    fetch: (request) => env.API.fetch(request),
    headers: () => ({ Authorization: `Bearer ${token}` }),
    onFailure: (kind) => reportApiFailure(env, kind),
  });
}

export function apiFetch(
  env: Env,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return clientFor(env, token).fetch(path, init);
}

// Fire-and-forget anonymous telemetry to the api's public /api/events (docs/specs/017-telemetry/telemetry.md),
// handed to the request's waitUntil (request-scope.ts) so the runtime can't cancel it when the response
// goes out. The internal key keeps the MCP out of the anonymous per-IP rate-limit bucket (issue #36): a
// service binding carries no CF-Connecting-IP. Off unless the api has TELEMETRY_ENABLED.
export function postTelemetry(env: Env, category: string, action: string, type: string): void {
  const headers: Record<string, string> = env.INTERNAL_EVENTS_KEY
    ? { 'X-Internal-Events-Key': env.INTERNAL_EVENTS_KEY }
    : {};
  keepAlive(
    postEvents(
      API_BASE,
      (request) => env.API.fetch(request),
      [{ category, action, type }],
      headers,
    ),
  );
}

// Fetch + parse JSON, throwing ApiError on a non-2xx so tools surface a clear, model-correctable message.
// A 5xx or a request that never completed is reported to the Error category; a 4xx is model-correctable
// input, never reported.
export function apiJson<T>(
  env: Env,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return clientFor(env, token).json<T>(path, init);
}

// A text answer (a document view, docs/specs/024-agents/document-views.md) with its ETag, failing exactly
// as apiJson does.
export async function apiText(
  env: Env,
  token: string,
  path: string,
): Promise<{ text: string; etag: string | null }> {
  const { body, etag } = await clientFor(env, token).text(path);
  return { text: body, etag };
}

// One MCP-side api failure to the Error category, labelled with the tool that was running
// (`Http503.UpdateDocument`, `Internal.FindDocuments`; docs/specs/017-telemetry/telemetry.md).
export function reportApiFailure(env: Env, kind: string): void {
  postTelemetry(env, 'Error', 'Api', errorTypeToken(kind, currentTool()));
}
