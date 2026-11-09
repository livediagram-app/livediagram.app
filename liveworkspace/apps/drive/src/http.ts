// Responses and request bodies. Every refusal is `{ "error": "<code>" }` (`DriveErrorCode`) with a 4xx/5xx status
// (liveworkspace/docs/specs/005-drive/drive.md "The service").

import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import type { DriveErrorCode } from '@liveworkspace/drive';
import { json as plainJson } from '@liveworkspace/index-app/worker-http';

// The largest JSON body a route reads: every body is a few ids, a code and a state.
export const MAX_BODY_BYTES = 16 * 1024;

/** A JSON answer, never cached: everything here is one person's. */
export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'private, no-store');
  return plainJson(body, { ...init, headers });
}

export const STATUS_OF: Record<DriveErrorCode, number> = {
  drive_not_configured: 503,
  unauthorised: 401,
  not_connected: 404,
  needs_reconnect: 409,
  invalid_request: 400,
  invalid_state: 400,
  rate_limited: 429,
  not_found: 404,
  file_too_large: 413,
  google_failed: 502,
  storage_unavailable: 503,
  internal_error: 500,
};

export const fail = (error: DriveErrorCode, status = STATUS_OF[error]) =>
  json({ error }, { status });

export const noContent = () => new Response(null, { status: 204 });

export const notFound = () => fail('not_found');

/** The JSON object a request carries, or null for a missing, oversized, broken-off or malformed one. Read through a
 *  byte counter (api-kit's readCappedBody), so a chunked body, which declares no length, is never held past the cap. */
export async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) return null;
  if (request.body === null) return {};
  let text: string;
  try {
    const bytes = await readCappedBody(request.body as ReadableStream<Uint8Array>, MAX_BODY_BYTES);
    if (bytes === null) return null;
    text = new TextDecoder().decode(bytes);
  } catch {
    // A body that broke off mid-read is no body, not an empty one.
    return null;
  }
  if (!text) return {};
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
