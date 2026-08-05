import { describe, expect, it, vi } from 'vitest';
import { markTimelineEventsDeletedBySource } from './timeline';
import type { Env } from '../types';

// The source cascade (spec/138 §3.5).
//
// Regression coverage for a bug found driving the real API: only
// matching `source_id` left a deleted diagram's comment, action, and
// share-link events behind, each still rendering a bubble that linked
// to a 404. "About a diagram" is wider than "keyed on the diagram id",
// and the snapshot's `<sourceType>Id` is what closes the gap.

function fakeDb() {
  const run = vi.fn().mockResolvedValue({});
  const bind = vi.fn().mockReturnValue({ run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { env: { DB: { prepare } } as unknown as Env, prepare, bind };
}

describe('markTimelineEventsDeletedBySource', () => {
  it('matches events keyed on the id AND events that merely reference it', async () => {
    const { env, prepare, bind } = fakeDb();
    await markTimelineEventsDeletedBySource(env, 'diagram', 'd-1');

    const sql = prepare.mock.calls[0]![0] as string;
    expect(sql).toContain('source_id = ?2');
    // Without this clause a comment on the deleted diagram survives:
    // its source_id is the COMMENT's id, not the diagram's.
    expect(sql).toContain('json_extract');
    expect(bind).toHaveBeenCalledWith('diagram', 'd-1', 'diagramId');
  });

  // The helper is generic so a future per-team cascade doesn't have to
  // reinvent it; the snapshot key follows the source type.
  it('derives the snapshot key from the source type', async () => {
    const { env, bind } = fakeDb();
    await markTimelineEventsDeletedBySource(env, 'team', 't-9');
    expect(bind).toHaveBeenCalledWith('team', 't-9', 'teamId');
  });

  it('scopes the delete to one source type, never the whole table', async () => {
    const { env, prepare } = fakeDb();
    await markTimelineEventsDeletedBySource(env, 'diagram', 'd-1');
    expect(prepare.mock.calls[0]![0] as string).toContain('source_type = ?1');
  });
});
