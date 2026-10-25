import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDailyReturn } from './daily-return';

const KEY = 'liveplanner:v2:last-active-day';
const DAY = 86_400_000;
const MON = Date.UTC(2026, 9, 26, 9);

function stubStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    },
  });
  return map;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDailyReturn', () => {
  it('seeds the first day without a report, then reports once on each later UTC day', () => {
    stubStorage();
    let now = MON;
    const report = vi.fn();
    const open = createDailyReturn({ storageKey: KEY, report, now: () => now });
    open(false);
    open(false);
    expect(report).not.toHaveBeenCalled();
    now = MON + DAY;
    open(true);
    open(false);
    expect(report.mock.calls).toEqual([[true]]);
    now = MON + 3 * DAY;
    open(false);
    expect(report.mock.calls).toEqual([[true], [false]]);
  });

  it('counts once a day across every gate sharing the key (the editor and the Explorer)', () => {
    const map = stubStorage();
    map.set(KEY, '2026-10-25');
    const editor = vi.fn();
    const explorer = vi.fn();
    createDailyReturn({ storageKey: KEY, report: explorer, now: () => MON })(false);
    createDailyReturn({ storageKey: KEY, report: editor, now: () => MON })(false);
    expect(explorer).toHaveBeenCalledTimes(1);
    expect(editor).not.toHaveBeenCalled();
  });

  it('keeps each app to its own key: a return to one app is not a return to another', () => {
    const map = stubStorage();
    map.set('livedocuments:v2:last-active-day', '2026-10-25');
    const report = vi.fn();
    createDailyReturn({ storageKey: KEY, report, now: () => MON })(false);
    expect(report).not.toHaveBeenCalled();
    expect(map.get(KEY)).toBe('2026-10-26');
  });

  it('rolls at midnight UTC', () => {
    const map = stubStorage();
    map.set(KEY, '2026-10-25');
    const report = vi.fn();
    createDailyReturn({ storageKey: KEY, report, now: () => Date.UTC(2026, 9, 25, 23, 59) })(false);
    expect(report).not.toHaveBeenCalled();
    createDailyReturn({ storageKey: KEY, report, now: () => Date.UTC(2026, 9, 26, 0, 0) })(false);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('reports nothing where storage is missing or throws', () => {
    const report = vi.fn();
    createDailyReturn({ storageKey: KEY, report })(false);
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('blocked');
      },
    });
    createDailyReturn({ storageKey: KEY, report })(false);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '2026-01-01',
        setItem: () => {
          throw new Error('quota');
        },
      },
    });
    createDailyReturn({ storageKey: KEY, report })(false);
    expect(report).not.toHaveBeenCalled();
  });
});
