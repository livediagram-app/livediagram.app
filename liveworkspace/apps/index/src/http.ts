// Responses and request bodies. Every refusal is `{ "error": "<code>" }` with a 4xx status
// (liveworkspace/docs/one-explorer-contracts.md "Reaching the index").

import type { IndexErrorCode } from '@liveworkspace/index-client';
import { MAX_BODY_BYTES } from './config';

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  // Everything but the public keys is personal.
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'private, no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const fail = (status: number, error: IndexErrorCode) => json({ error }, { status });

export const badRequest = (error: IndexErrorCode = 'invalid_body') => fail(400, error);
export const unauthorized = () => fail(401, 'unauthorized');
export const forbidden = (error: IndexErrorCode = 'forbidden') => fail(403, error);
export const notFound = (error: IndexErrorCode = 'not_found') => fail(404, error);
export const conflict = (error: IndexErrorCode) => fail(409, error);
export const noContent = () => new Response(null, { status: 204 });

// The JSON object a request carries, or null for a missing, oversized or malformed one.
export async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) return null;
  // A body that broke off mid-read is no body, not an empty one: `{}` would read as "clear everything" to a route like
  // PUT /items/:id/share-password.
  const text = await request.text().catch(() => null);
  if (text === null || text.length > MAX_BODY_BYTES) return null;
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
