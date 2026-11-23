// A public roadmap's answers (docs/specs/026-plan/public-roadmap.md "How it answers"): never cached, so an edit or an
// Unpublish shows on the next read; never indexed; no referrer. Every miss is the same 404, whatever its reason, which
// only the log names.
import type { RoadmapError } from '@liveplanner/api-schema';
import { json } from '../responses';

export const PUBLIC_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
} as const;

/** A public answer with the roadmap's headers. */
export const publicAnswer = (body: unknown, status = 200): Response =>
  json(body, { status, headers: PUBLIC_HEADERS });

/** A public refusal naming its error. */
export const publicRefusal = (error: RoadmapError | 'method_not_allowed', status: number) =>
  publicAnswer({ error }, status);

export type MissReason =
  'malformed' | 'no_plan' | 'unknown_code' | 'no_board' | 'voting_off' | 'uncounted';

/** The one answer for every roadmap that is not there now, its reason logged. */
export function roadmapMissed(reason: MissReason): Response {
  console.info('[roadmap] read.missed', { reason });
  return publicRefusal('roadmap_not_found', 404);
}
