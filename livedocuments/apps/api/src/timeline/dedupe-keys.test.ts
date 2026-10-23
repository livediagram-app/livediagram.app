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
  mergeScopes: vi.fn((...lists: unknown[][]) => lists.flat()),
  userScope: (id: string) => ({ scopeType: 'user', scopeId: id }),
}));

import { dedupeKeyForDay } from '../db/timeline';
import type { Env } from '../types';
import { recordDocumentMoved } from './document-events';

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
  it('two moves of one document are two rows, not one upserted', async () => {
    await recordDocumentMoved(
      env,
      { id: 'd1', name: 'Notes', ownerId: 'me', teamId: null },
      'Drafts',
      'me',
    );
    await recordDocumentMoved(
      env,
      { id: 'd1', name: 'Notes', ownerId: 'me', teamId: null },
      'Archive',
      'me',
    );
    const [a, b] = keys();
    expect(a).not.toBe(b);
  });

  it('a per-day key is one card for a day, a new one the next', () => {
    const morning = Date.parse('2026-09-22T10:00:00Z');
    const evening = Date.parse('2026-09-22T15:00:00Z');
    const nextMonth = Date.parse('2026-10-01T10:00:00Z');
    expect(dedupeKeyForDay('me', morning)).toBe(dedupeKeyForDay('me', evening));
    expect(dedupeKeyForDay('me', nextMonth)).not.toBe(dedupeKeyForDay('me', morning));
  });
});
