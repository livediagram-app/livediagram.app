import { beforeEach, describe, expect, it, vi } from 'vitest';

// Repeatable events get a fresh row each time (docs/specs/013-workspace/timeline.md §3.1).
//
// The regression: a rename carried the default '' dedupe key, so the
// UNIQUE index on (source_type, source_id, event_type, dedupe_key) took
// the second rename of a document for a retry of the first and upserted
// it. Three renames in a day showed one card instead of a stack of
// three, and a rename this month moved last month's card to today.

const { emit } = vi.hoisted(() => ({ emit: { emitTimelineEvent: vi.fn() } }));
vi.mock('../db/timeline', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, emitTimelineEvent: emit.emitTimelineEvent };
});
vi.mock('./audience', () => ({
  audienceForDocument: vi.fn(async () => [{ scopeType: 'user', scopeId: 'me' }]),
  audienceForTeam: vi.fn(async () => [{ scopeType: 'user', scopeId: 'me' }]),
  adminsForTeam: vi.fn(async () => []),
  mergeScopes: vi.fn((...lists: unknown[][]) => lists.flat()),
  userScope: (id: string) => ({ scopeType: 'user', scopeId: id }),
}));

import type { Env } from '../types';
import { recordTeamRenamed } from './team-events';
import { recordThemeSaved } from './account-events';

const env = {} as Env;

function keys(): string[] {
  return emit.emitTimelineEvent.mock.calls.map(
    ([, draft]) => (draft as { dedupeKey?: string }).dedupeKey ?? '',
  );
}

beforeEach(() => {
  emit.emitTimelineEvent.mockReset();
  emit.emitTimelineEvent.mockResolvedValue(undefined);
});

describe('repeatable events carry a unique dedupe key', () => {
  it('two renames of one team are two rows, not one upserted', async () => {
    await recordTeamRenamed(env, { id: 't1', name: 'Guild' }, 'Old Guild', 'me');
    await recordTeamRenamed(env, { id: 't1', name: 'Guild 2' }, 'Guild', 'me');
    const [a, b] = keys();
    expect(a).not.toBe(b);
  });

  it('a theme saved twice in a day is one card, saved on another day a new one', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-22T10:00:00Z'));
      await recordThemeSaved(env, { id: 'th1', name: 'Dusk' }, 'me');
      vi.setSystemTime(new Date('2026-09-22T15:00:00Z'));
      await recordThemeSaved(env, { id: 'th1', name: 'Dusk' }, 'me');
      vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
      await recordThemeSaved(env, { id: 'th1', name: 'Dusk' }, 'me');
      const [a, b, c] = keys();
      expect(a).toBe(b);
      expect(c).not.toBe(a);
    } finally {
      vi.useRealTimers();
    }
  });
});
