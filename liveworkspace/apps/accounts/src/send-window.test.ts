import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  DEFAULT_TIME_ZONE,
  insideWindow,
  knownTimeZones,
  MAX_TIME_ZONE_LENGTH,
  parseSendWindow,
  parseTimeZone,
  SEND_WINDOW,
  sendWindowOf,
  windowFilter,
} from './send-window.ts';

// Instants by their UTC wall clock. 2026-11-04 is a Wednesday, and London is on GMT (UTC) then.
const utc = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);
const inside = (zone: string, at: number) => insideWindow(SEND_WINDOW, zone, at);

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('the window', () => {
  it('opens at 09:00 and closes at 21:00, local time', () => {
    expect(inside('Europe/London', utc(2026, 11, 4, 8, 59))).toBe(false);
    expect(inside('Europe/London', utc(2026, 11, 4, 9, 0))).toBe(true);
    expect(inside('Europe/London', utc(2026, 11, 4, 20, 59))).toBe(true);
    expect(inside('Europe/London', utc(2026, 11, 4, 21, 0))).toBe(false);
    expect(inside('Europe/London', utc(2026, 11, 4, 3, 0))).toBe(false);
  });

  it('is shut all Saturday and Sunday, and open on Friday and Monday', () => {
    // 2026-11-06 is a Friday.
    expect(inside('Europe/London', utc(2026, 11, 6, 12))).toBe(true);
    expect(inside('Europe/London', utc(2026, 11, 7, 12))).toBe(false);
    expect(inside('Europe/London', utc(2026, 11, 7, 9))).toBe(false);
    expect(inside('Europe/London', utc(2026, 11, 8, 12))).toBe(false);
    expect(inside('Europe/London', utc(2026, 11, 8, 20, 59))).toBe(false);
    expect(inside('Europe/London', utc(2026, 11, 9, 9))).toBe(true);
  });

  it("goes by the recipient's own day: Friday evening in New York is Saturday in Tokyo", () => {
    const at = utc(2026, 11, 7, 0, 30); // Fri 19:30 in New York, Sat 09:30 in Tokyo
    expect(inside('America/New_York', at)).toBe(true);
    expect(inside('Asia/Tokyo', at)).toBe(false);
    expect(inside('Europe/London', at)).toBe(false);
  });

  it('keeps to the zone across the clocks going forward', () => {
    // New York: EST (UTC-5) until Sunday 2026-03-08, EDT (UTC-4) after.
    expect(inside('America/New_York', utc(2026, 3, 6, 13, 59))).toBe(false); // Fri 08:59 EST
    expect(inside('America/New_York', utc(2026, 3, 6, 14, 0))).toBe(true); // Fri 09:00 EST
    expect(inside('America/New_York', utc(2026, 3, 9, 12, 59))).toBe(false); // Mon 08:59 EDT
    expect(inside('America/New_York', utc(2026, 3, 9, 13, 0))).toBe(true); // Mon 09:00 EDT
    expect(inside('America/New_York', utc(2026, 3, 10, 0, 59))).toBe(true); // Mon 20:59 EDT
    expect(inside('America/New_York', utc(2026, 3, 10, 1, 0))).toBe(false); // Mon 21:00 EDT
    // London: GMT until Sunday 2026-03-29, BST (UTC+1) after.
    expect(inside('Europe/London', utc(2026, 3, 27, 8, 30))).toBe(false); // Fri 08:30 GMT
    expect(inside('Europe/London', utc(2026, 3, 30, 8, 30))).toBe(true); // Mon 09:30 BST
    expect(inside('Europe/London', utc(2026, 3, 30, 19, 59))).toBe(true); // Mon 20:59 BST
    expect(inside('Europe/London', utc(2026, 3, 30, 20, 0))).toBe(false); // Mon 21:00 BST
  });

  it('keeps to the zone across the clocks going back', () => {
    // New York: EDT until Sunday 2026-11-01, EST after.
    expect(inside('America/New_York', utc(2026, 10, 30, 12, 59))).toBe(false); // Fri 08:59 EDT
    expect(inside('America/New_York', utc(2026, 10, 30, 13, 0))).toBe(true); // Fri 09:00 EDT
    expect(inside('America/New_York', utc(2026, 11, 2, 13, 0))).toBe(false); // Mon 08:00 EST
    expect(inside('America/New_York', utc(2026, 11, 2, 14, 0))).toBe(true); // Mon 09:00 EST
    // London: BST until Sunday 2026-10-25, GMT after.
    expect(inside('Europe/London', utc(2026, 10, 23, 8, 0))).toBe(true); // Fri 09:00 BST
    expect(inside('Europe/London', utc(2026, 10, 26, 8, 0))).toBe(false); // Mon 08:00 GMT
    expect(inside('Europe/London', utc(2026, 10, 26, 20, 59))).toBe(true); // Mon 20:59 GMT
  });

  it('takes zones off the hour, as an hourly run lands in them', () => {
    // Kolkata is UTC+5:30: the 03:17 UTC run is 08:47 there, the 04:17 one 09:47.
    expect(inside('Asia/Kolkata', utc(2026, 11, 4, 3, 17))).toBe(false);
    expect(inside('Asia/Kolkata', utc(2026, 11, 4, 4, 17))).toBe(true);
  });
});

describe('parseTimeZone', () => {
  it('takes the zone names browsers send, as the runtime keeps them', () => {
    expect(parseTimeZone('Europe/London')).toBe('Europe/London');
    expect(parseTimeZone('America/Argentina/Buenos_Aires')).toBe(
      parseTimeZone('America/Buenos_Aires'),
    );
    expect(parseTimeZone('UTC')).toBe('UTC');
    // An alias and its zone are kept as one name, whichever the browser uses.
    expect(parseTimeZone('Asia/Calcutta')).toBe(parseTimeZone('Asia/Kolkata'));
    expect(knownTimeZones().has(parseTimeZone('Asia/Kolkata')!)).toBe(true);
    expect(knownTimeZones().has(parseTimeZone('Etc/UTC')!)).toBe(true);
  });

  it('refuses anything that is not a zone', () => {
    for (const value of [
      'Mars/Olympus_Mons',
      '',
      'not a zone',
      '+05:30',
      'Europe/London; DROP TABLE user',
      'E'.repeat(MAX_TIME_ZONE_LENGTH + 1),
      42,
      null,
      undefined,
      { zone: 'Europe/London' },
    ]) {
      expect(parseTimeZone(value)).toBeNull();
    }
  });
});

describe('parseSendWindow', () => {
  it('is Monday to Friday 09:00 to 21:00 in London when unset', () => {
    expect(parseSendWindow(undefined, undefined)).toEqual(SEND_WINDOW);
    expect(SEND_WINDOW.zone).toBe(DEFAULT_TIME_ZONE);
    expect(DEFAULT_TIME_ZONE).toBe('Europe/London');
  });

  it('is none with `always`', () => {
    expect(parseSendWindow('always', undefined)).toBeNull();
  });

  it('takes days and hours, a day range that wraps, and a default zone', () => {
    const window = parseSendWindow('Sat-Mon 08:00-18:00', 'America/Chicago')!;
    expect([...window.days].sort()).toEqual([0, 1, 6]);
    expect(window).toMatchObject({ start: 8 * 60, end: 18 * 60, zone: 'America/Chicago' });
    expect(parseSendWindow('Mon-Sun 00:00-24:00', undefined)).toMatchObject({
      start: 0,
      end: 24 * 60,
    });
  });

  it('falls back to the default, warned, on what it cannot read', () => {
    for (const spec of ['Mon-Fri 9-21', 'weekdays', 'Mon-Fri 21:00-09:00', 'Mon-Fri 09:00-25:00']) {
      expect(parseSendWindow(spec, undefined)).toEqual(SEND_WINDOW);
    }
    expect(parseSendWindow(undefined, 'Nowhere/Special')).toEqual(SEND_WINDOW);
    expect(console.warn).toHaveBeenCalledTimes(5);
  });

  it("reads the Worker's vars once per pair of values", () => {
    const env = { EMAIL_SEND_WINDOW: 'Tue-Thu 10:00-16:00' };
    expect(sendWindowOf(env)).toBe(sendWindowOf({ ...env }));
    expect(sendWindowOf({})).toEqual(SEND_WINDOW);
    expect(sendWindowOf({ EMAIL_SEND_WINDOW: 'always' })).toBeNull();
  });
});

describe('windowFilter', () => {
  it('is no filter without a window', () => {
    expect(windowFilter('u.timeZone', null, utc(2026, 11, 7, 3))).toBeNull();
  });

  it('is closed when every zone is in its weekend', () => {
    // Saturday 12:00 UTC is Saturday or Sunday everywhere.
    expect(windowFilter('u.timeZone', SEND_WINDOW, utc(2026, 11, 7, 12))).toBe('closed');
  });

  it("names the zones outside while London is inside, so no zone known reads as London's", () => {
    const filter = windowFilter('u.timeZone', SEND_WINDOW, utc(2026, 11, 4, 12));
    expect(filter).toMatchObject({
      sql: '(u.timeZone IS NULL OR u.timeZone NOT IN (SELECT value FROM json_each(?)))',
    });
    const outside = JSON.parse((filter as { bind: string }).bind) as string[];
    expect(outside).toContain('America/Los_Angeles'); // 04:00
    expect(outside).not.toContain('Europe/London');
    expect(outside).not.toContain('Europe/Paris');
  });

  it('names the zones inside while London is outside', () => {
    const filter = windowFilter('r.timeZone', SEND_WINDOW, utc(2026, 11, 4, 2));
    expect(filter).toMatchObject({ sql: 'r.timeZone IN (SELECT value FROM json_each(?))' });
    const inside = JSON.parse((filter as { bind: string }).bind) as string[];
    expect(inside).toContain('Asia/Tokyo'); // 11:00
    expect(inside).not.toContain('Europe/London');
  });

  it('works out an instant within a small CPU budget, however many zones the runtime knows', () => {
    // A fresh instant each pass, so no pass is answered from the last one's split.
    let at = utc(2026, 11, 4, 0, 17);
    const spent = cpuMsOf(() => {
      for (let pass = 0; pass < 24; pass++)
        windowFilter('u.timeZone', SEND_WINDOW, (at += 3_600_000));
    });
    expect(knownTimeZones().size).toBeGreaterThan(300);
    expect(spent).toBeLessThan(cpuBudgetMs(250));
  });
});
