// The account API's answers and request bodies (account-api.ts).

import type { Result } from '../teams.ts';

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
export const error = (status: number, code: string) => json({ error: code }, status);

export function answer<T>(result: Result<T>, status = 200): Response {
  return result.ok ? json(result.value, status) : error(result.status, result.error);
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}));
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

export type WaitUntil = (promise: Promise<unknown>) => void;
