import { beforeEach, describe, expect, it, vi } from 'vitest';

// Repeatable events get a fresh row each time (docs/specs/013-workspace/timeline.md §3.1).
//
// The regression: a rename carried the default '' dedupe key, so the
// UNIQUE index on (source_type, source_id, event_type, dedupe_key) took
// the second rename of a diagram for a retry of the first and upserted
// it. Three renames in a day showed one card instead of a stack of
// three, and a rename this month moved last month's card to today.

const { emit } = vi.hoisted(() => ({ emit: { emitTimelineEvent: vi.fn() } }));
vi.mock('../db/timeline', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, emitTimelineEvent: emit.emitTimelineEvent };
});
vi.mock('./audience', () => ({
  audienceForDiagram: vi.fn(async () => [{ scopeType: 'user', scopeId: 'me' }]),
  audienceForTeam: vi.fn(async () => [{ scopeType: 'user', scopeId: 'me' }]),
  adminsForTeam: vi.fn(async () => []),
  mergeScopes: vi.fn((...lists: unknown[][]) => lists.flat()),
  userScope: (id: string) => ({ scopeType: 'user', scopeId: id }),
}));

import type { Env } from '../types';
import { recordDiagramRenamed } from './diagram-events';
import { recordTeamRenamed } from './team-events';
import { recordThemeSaved } from './account-events';

const env = {} as Env;
const diagram = { id: 'd1', name: 'Payments v2', ownerId: 'me', teamId: null } as never;

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
  it('two renames of one diagram are two rows, not one upserted', async () => {
    await recordDiagramRenamed(env, diagram, 'Payments', 'me');
    await recordDiagramRenamed(env, diagram, 'Payments v1', 'me');
    const [a, b] = keys();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('the same for a team rename', async () => {
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
