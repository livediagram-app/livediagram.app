// The safety wrapper every timeline emit goes through (spec/138 §4).
//
// A timeline row is a nice-to-have hanging off someone else's write. If
// the emit throws — a malformed snapshot, a D1 hiccup, a scope lookup
// that raced a team deletion — the diagram save that triggered it must
// still succeed. So every call site goes through `record`, which
// swallows and logs rather than propagating.
//
// Call sites additionally wrap this in `ctx.waitUntil(...)` so the emit
// runs after the response is sent and never adds latency to a save.

import type { TimelineScopeRef } from '@livediagram/api-schema';
import type { TimelineEventDraft } from '../db/timeline';
import { emitTimelineEvent } from '../db/timeline';
import type { Env } from '../types';

export async function record(
  env: Env,
  draft: TimelineEventDraft,
  scopes: TimelineScopeRef[],
): Promise<void> {
  try {
    await emitTimelineEvent(env, draft, scopes);
  } catch (err) {
    // Logged, not rethrown, and not self-reported to the telemetry
    // Error category: a timeline emit failing is invisible to the user
    // and reporting it would drown the signal the Error category
    // exists for (spec/22).
    console.error('timeline emit failed', draft.eventType, err);
  }
}

// Trim user content to fit a description without letting one essay
// dominate a day's feed. Breaks on the last space before the limit
// where there is one, so the ellipsis doesn't land mid-word.
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}
