// The generation fence, the server's half (liveworkspace/docs/specs/013-snapshots/snapshots.md "No stale writes after a
// revert"; blueprint SN16 to SN18): a write from an editor that last saw the item before its latest revert is refused
// before any handler runs, and every answer about a reverted item says its generation.

import { SNAPSHOT_FENCED_HEADER, SNAPSHOT_GENERATION_HEADER, type SnapshotError } from './wire';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The generation a request names, or null when it names none (or nothing a generation can be). */
export function requestGeneration(request: Request): number | null {
  const raw = request.headers.get(SNAPSHOT_GENERATION_HEADER);
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  return Number(raw);
}

/** SN16: 409 `snapshot_reverted` for a write naming a generation older than the item's; null otherwise. */
export function fenceStaleWrite(request: Request, generation: number): Response | null {
  if (generation <= 0 || READS.has(request.method.toUpperCase())) return null;
  const named = requestGeneration(request);
  if (named === null || named >= generation) return null;
  console.info('[snapshots] refused', { reason: 'stale-write', named, generation });
  const body: SnapshotError = {
    error: 'snapshot_reverted',
    message: 'Someone reverted this to a snapshot. Reload to see it.',
  };
  return new Response(JSON.stringify(body), {
    status: 409,
    headers: {
      'Content-Type': 'application/json',
      [SNAPSHOT_GENERATION_HEADER]: String(generation),
      [SNAPSHOT_FENCED_HEADER]: '1',
    },
  });
}

/** SN17: the response with the item's generation on it, 0 before any revert, so every editor that has read the item
 *  names the generation it holds from then on (a socket's upgrade carries none). */
export function stampGeneration(response: Response, generation: number): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set(SNAPSHOT_GENERATION_HEADER, String(generation));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
