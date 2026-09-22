import { describe, expect, it, vi } from 'vitest';
import {
  countUnseen,
  dismissTimelineEventForScope,
  dismissTimelineEventsForScope,
  readTimeline,
} from './timeline';
import type { Env } from '../types';

// Per-entry dismissal (spec/138 §2.9).
//
// The dismissal is a soft mark on the MEMBERSHIP row, so the read side
// has to filter it everywhere a membership is joined: the feed itself
// and the unread count. Missing either would make a removed card either
// reappear on the page or keep pinning the sidebar badge.

function fakeDb(first: unknown = null) {
  const run = vi.fn().mockResolvedValue({});
  const all = vi.fn().mockResolvedValue({ results: [] });
  const firstFn = vi.fn().mockResolvedValue(first);
  const bind = vi.fn().mockReturnValue({ run, all, first: firstFn });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { env: { DB: { prepare } } as unknown as Env, prepare, bind, run };
}

const SCOPE = { scopeType: 'user' as const, scopeId: 'u-1' };

describe('dismissTimelineEventForScope', () => {
  it('marks the membership row for that one scope, not the event', async () => {
    const { env, prepare, bind, run } = fakeDb({ deleted_at: null });
    expect(await dismissTimelineEventForScope(env, SCOPE, 'ev-1')).toBe(true);
    const update = prepare.mock.calls[1]![0] as string;
    expect(update).toContain('UPDATE timeline_event_scopes SET deleted_at');
    expect(update).not.toContain('DELETE');
    expect(bind).toHaveBeenLastCalledWith('user', 'u-1', 'ev-1', expect.any(Number));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reports false when the scope never held the event', async () => {
    const { env, run } = fakeDb(null);
    expect(await dismissTimelineEventForScope(env, SCOPE, 'ev-x')).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('is idempotent: a second dismissal writes nothing and still succeeds', async () => {
    const { env, run } = fakeDb({ deleted_at: 123 });
    expect(await dismissTimelineEventForScope(env, SCOPE, 'ev-1')).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('dismissTimelineEventsForScope', () => {
  it('marks every listed membership in one statement and reports the count', async () => {
    const { env, prepare, bind } = fakeDb();
    (env.DB.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: bind.mockReturnValue({ run: vi.fn().mockResolvedValue({ meta: { changes: 2 } }) }),
    });
    expect(await dismissTimelineEventsForScope(env, SCOPE, ['ev-1', 'ev-2', 'gone'])).toBe(2);
    expect(prepare).toHaveBeenCalledTimes(1);
    const sql = prepare.mock.calls[0]![0] as string;
    expect(sql).toContain('UPDATE timeline_event_scopes SET deleted_at');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('event_id IN (?4, ?5, ?6)');
    expect(bind).toHaveBeenCalledWith('user', 'u-1', expect.any(Number), 'ev-1', 'ev-2', 'gone');
  });

  it('does nothing for an empty list', async () => {
    const { env, prepare } = fakeDb();
    expect(await dismissTimelineEventsForScope(env, SCOPE, [])).toBe(0);
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('dismissed memberships are invisible to every read', () => {
  it('the feed skips them', async () => {
    const { env, prepare } = fakeDb();
    await readTimeline(env, { scope: SCOPE, limit: 10 });
    expect(prepare.mock.calls[0]![0] as string).toContain('s.deleted_at IS NULL');
  });

  it('the unread count skips them', async () => {
    const { env, prepare } = fakeDb({ n: 0 });
    await countUnseen(env, SCOPE, 0);
    expect(prepare.mock.calls[0]![0] as string).toContain('s.deleted_at IS NULL');
  });
});
