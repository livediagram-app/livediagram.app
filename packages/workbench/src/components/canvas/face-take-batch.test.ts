// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushFaceTakes, scheduleFaceTake, type FaceTake } from './face-take-batch';

// docs/specs/008-canvas/finish.md "Performance": the faces on a board take their finish together, every face cleared,
// then every face read, then every face written, so a batch lays the board out once however many faces it holds.

afterEach(() => {
  flushFaceTakes();
  vi.useRealTimers();
});

/** A take that logs each of its steps as `<step><name>`. */
function logged(log: string[], name: string): FaceTake {
  return {
    prepare: () => log.push(`p${name}`),
    read: () => {
      log.push(`r${name}`);
      return () => {
        log.push(`w${name}`);
      };
    },
  };
}

const roots = (n: number) => Array.from({ length: n }, () => document.createElement('div'));

describe('scheduleFaceTake', () => {
  it('reads every face before it writes any, however many faces there are', async () => {
    for (const n of [1, 10, 2000]) {
      const log: string[] = [];
      roots(n).forEach((root, i) => scheduleFaceTake(root, logged(log, String(i)), 'now'));
      await Promise.resolve();
      const steps = log.map((s) => s[0]).join('');
      // One read pass: all prepares, then all reads, then all writes.
      expect(steps).toBe('p'.repeat(n) + 'r'.repeat(n) + 'w'.repeat(n));
    }
  });

  it('takes a mounting face at the end of the task, before the next frame', async () => {
    const log: string[] = [];
    scheduleFaceTake(document.createElement('div'), logged(log, 'a'), 'now');
    expect(log).toEqual([]);
    await Promise.resolve();
    expect(log).toEqual(['pa', 'ra', 'wa']);
  });

  it('takes a settled face at the next frame, with the others that settled before it', () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const [a, b] = roots(2);
    scheduleFaceTake(a!, logged(log, 'a'), 'frame');
    scheduleFaceTake(b!, logged(log, 'b'), 'frame');
    expect(log).toEqual([]);
    vi.advanceTimersToNextFrame();
    expect(log).toEqual(['pa', 'pb', 'ra', 'rb', 'wa', 'wb']);
  });

  it('falls back to a timer where there are no animation frames', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    try {
      const log: string[] = [];
      scheduleFaceTake(document.createElement('div'), logged(log, 'a'), 'frame');
      vi.advanceTimersByTime(16);
      expect(log).toEqual(['pa', 'ra', 'wa']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('takes a face once per batch, its latest take, and never a cancelled one', async () => {
    const log: string[] = [];
    const [a, b] = roots(2);
    scheduleFaceTake(a!, logged(log, 'old'), 'now');
    scheduleFaceTake(a!, logged(log, 'new'), 'frame');
    const cancel = scheduleFaceTake(b!, logged(log, 'b'), 'now');
    cancel();
    await Promise.resolve();
    expect(log).toEqual(['pnew', 'rnew', 'wnew']);
  });

  it("leaves a newer take queued when an older one's cancel runs", async () => {
    const log: string[] = [];
    const root = document.createElement('div');
    const cancelOld = scheduleFaceTake(root, logged(log, 'old'), 'now');
    scheduleFaceTake(root, logged(log, 'new'), 'now');
    cancelOld();
    await Promise.resolve();
    expect(log).toEqual(['pnew', 'rnew', 'wnew']);
  });

  it('copies a face after its own pass has drawn, in the same batch', async () => {
    const log: string[] = [];
    const root = document.createElement('div');
    scheduleFaceTake(root, logged(log, 'copy'), 'now', 'copy');
    scheduleFaceTake(
      root,
      {
        read: () => () => {
          log.push('wface');
        },
      },
      'now',
    );
    await Promise.resolve();
    expect(log).toEqual(['wface', 'pcopy', 'rcopy', 'wcopy']);
  });

  it('finishes every other face when one throws, then throws its error', () => {
    const log: string[] = [];
    const [a, b] = roots(2);
    const broken = new Error('broken face');
    scheduleFaceTake(
      a!,
      {
        read: () => {
          throw broken;
        },
      },
      'frame',
    );
    scheduleFaceTake(b!, logged(log, 'b'), 'frame');
    expect(() => flushFaceTakes()).toThrow(broken);
    expect(log).toEqual(['pb', 'rb', 'wb']);
  });

  it('runs what follows the writes once every face is written', async () => {
    const log: string[] = [];
    roots(2).forEach((root, i) =>
      scheduleFaceTake(
        root,
        {
          read: () => () => {
            log.push(`w${i}`);
            return () => {
              log.push(`a${i}`);
            };
          },
        },
        'now',
      ),
    );
    await Promise.resolve();
    expect(log).toEqual(['w0', 'w1', 'a0', 'a1']);
  });
});
