// Join and leave sounds (docs/specs/012-collaboration/join-and-leave-sounds.md; blueprint "Testing").
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createPresenceChimes,
  JOIN_LEAVE_BURST_MS,
  JOIN_LEAVE_FLAP_MS,
  presenceChimesWanted,
  type PresenceChime,
} from './presence-chimes';
import { setQuietForDoNotDisturb } from './quiet';

const prefs = vi.hoisted(() => ({ value: {} as { joinLeaveSounds?: boolean } }));
vi.mock('@/lib/user-preferences', () => ({ readUserPreferences: () => prefs.value }));

const p = (id: string, key?: string, role?: string) => ({
  id,
  ...(key ? { key } : {}),
  ...(role ? { role } : {}),
});

function watcher(selfKey: string | null = 'me') {
  const played: PresenceChime[] = [];
  const chimes = createPresenceChimes({
    selfKey,
    play: (kind) => played.push(kind),
    wanted: () => true,
  });
  return { chimes, played };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  prefs.value = {};
  setQuietForDoNotDisturb(false);
});
afterEach(() => vi.useRealTimers());

describe('createPresenceChimes', () => {
  it('learns the first roster in silence, then chimes for a newcomer', () => {
    const { chimes, played } = watcher();
    chimes.update([p('s1', 'a'), p('s2', 'b')]);
    expect(played).toEqual([]);
    chimes.update([p('s1', 'a'), p('s2', 'b'), p('s3', 'c')]);
    expect(played).toEqual(['arrive']);
  });

  it('never chimes for yourself, your other tab included', () => {
    const { chimes, played } = watcher('me');
    chimes.update([]);
    chimes.update([p('s9', 'me')]);
    chimes.update([]);
    vi.advanceTimersByTime(JOIN_LEAVE_FLAP_MS + 1);
    expect(played).toEqual([]);
  });

  it('counts one person on two sockets once', () => {
    const { chimes, played } = watcher();
    chimes.update([p('s1', 'a')]);
    chimes.update([p('s1', 'a'), p('s2', 'a')]);
    chimes.update([p('s2', 'a')]);
    vi.advanceTimersByTime(JOIN_LEAVE_FLAP_MS + 1);
    expect(played).toEqual([]);
  });

  it('falls back to the presence id for a peer with no key', () => {
    const { chimes, played } = watcher();
    chimes.update([]);
    chimes.update([p('s1')]);
    expect(played).toEqual(['arrive']);
  });

  it('plays a leave only once the person stays gone past the flap window', () => {
    const { chimes, played } = watcher();
    chimes.update([p('s1', 'a')]);
    chimes.update([]);
    vi.advanceTimersByTime(JOIN_LEAVE_FLAP_MS - 1);
    expect(played).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(played).toEqual(['leave']);
  });

  it('is silent for a reconnect inside the flap window', () => {
    const { chimes, played } = watcher();
    chimes.update([p('s1', 'a')]);
    chimes.update([]);
    vi.advanceTimersByTime(2_000);
    chimes.update([p('s7', 'a')]);
    vi.advanceTimersByTime(JOIN_LEAVE_FLAP_MS * 2);
    expect(played).toEqual([]);
  });

  it('plays a burst of arrivals once, and again after the burst window', () => {
    const { chimes, played } = watcher();
    chimes.update([]);
    chimes.update([p('s1', 'a'), p('s2', 'b')]);
    vi.advanceTimersByTime(300);
    chimes.update([p('s1', 'a'), p('s2', 'b'), p('s3', 'c')]);
    expect(played).toEqual(['arrive']);
    vi.advanceTimersByTime(JOIN_LEAVE_BURST_MS);
    chimes.update([p('s1', 'a'), p('s2', 'b'), p('s3', 'c'), p('s4', 'd')]);
    expect(played).toEqual(['arrive', 'arrive']);
  });

  it('plays a burst of leaves once', () => {
    const { chimes, played } = watcher();
    chimes.update([p('s1', 'a'), p('s2', 'b'), p('s3', 'c')]);
    chimes.update([p('s3', 'c')]);
    vi.advanceTimersByTime(200);
    chimes.update([]);
    vi.advanceTimersByTime(JOIN_LEAVE_FLAP_MS + 200);
    expect(played).toEqual(['leave']);
  });

  it('hears every role arrive: presence is everyone', () => {
    const { chimes, played } = watcher();
    chimes.update([]);
    for (const [i, role] of ['edit', 'participate', 'view'].entries()) {
      vi.advanceTimersByTime(JOIN_LEAVE_BURST_MS);
      chimes.update(
        ['edit', 'participate', 'view'].slice(0, i + 1).map((r) => p(`s-${r}`, r, role)),
      );
    }
    expect(played).toEqual(['arrive', 'arrive', 'arrive']);
  });

  it('plays nothing when not wanted, and dispose clears pending leaves', () => {
    const played: PresenceChime[] = [];
    const chimes = createPresenceChimes({
      selfKey: 'me',
      play: (k) => played.push(k),
      wanted: () => false,
    });
    chimes.update([p('s1', 'a')]);
    chimes.update([p('s1', 'a'), p('s2', 'b')]);
    chimes.update([]);
    chimes.dispose();
    vi.advanceTimersByTime(JOIN_LEAVE_FLAP_MS * 2);
    expect(played).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reads 100 updates of a 100 person roster in a moment', () => {
    const { chimes } = watcher();
    const rosters = Array.from({ length: 100 }, (_, round) =>
      Array.from({ length: 100 }, (_, i) => p(`s${(i + round) % 120}`, `k${(i + round) % 120}`)),
    );
    // About 1 ms measured on a laptop: a Set build and two scans per update.
    const best = Math.min(
      ...[0, 1, 2].map(() =>
        cpuMsOf(() => {
          for (const roster of rosters) chimes.update(roster);
        }),
      ),
    );
    chimes.dispose();
    expect(best).toBeLessThan(cpuBudgetMs(20));
  });
});

describe('presenceChimesWanted', () => {
  it('is on by default, off with the setting off or on Do Not Disturb', () => {
    expect(presenceChimesWanted()).toBe(true);
    prefs.value = { joinLeaveSounds: false };
    expect(presenceChimesWanted()).toBe(false);
    prefs.value = { joinLeaveSounds: true };
    setQuietForDoNotDisturb(true);
    expect(presenceChimesWanted()).toBe(false);
  });

  it('the default watcher plays through Web Audio only while wanted', async () => {
    const tones = vi.fn();
    vi.doMock('./audio', () => ({ playTones: tones }));
    vi.resetModules();
    const mod = await import('./presence-chimes');
    const chimes = mod.createPresenceChimes({ selfKey: 'me' });
    chimes.update([]);
    chimes.update([p('s1', 'a')]);
    expect(tones).toHaveBeenCalledTimes(1);
    prefs.value = { joinLeaveSounds: false };
    chimes.update([]);
    vi.advanceTimersByTime(JOIN_LEAVE_FLAP_MS);
    expect(tones).toHaveBeenCalledTimes(1);
    prefs.value = {};
    mod.playPresenceChime('leave');
    expect(tones).toHaveBeenCalledTimes(2);
    vi.doUnmock('./audio');
  });
});
