// The zone caches stay bounded whatever zone strings arrive (Work Tracker 232; blueprint item-types.md
// "date-time-fields.ts"): unknown zones are never kept, and known ones evict the oldest past ZONE_CACHE_MAX.
import { describe, expect, it } from 'vitest';
import {
  isTimeZone,
  momentText,
  timeOfDayText,
  ZONE_CACHE_MAX,
  zoneCacheSizes,
  zonedParts,
} from './date-time-fields';

const MOMENT = Date.UTC(2026, 9, 31, 17, 0);
const ZONES = Intl.supportedValuesOf('timeZone');

describe('zone caches', () => {
  it('never keeps a zone the runtime does not know, however many arrive', () => {
    const before = zoneCacheSizes().zoneChecks;
    for (let i = 0; i < 5000; i++) expect(isTimeZone(`Nowhere/Place_${i}`)).toBe(false);
    expect(zoneCacheSizes().zoneChecks).toBe(before);
  });

  it('holds each cache to ZONE_CACHE_MAX across every zone the runtime knows', () => {
    expect(ZONES.length).toBeGreaterThan(ZONE_CACHE_MAX);
    for (const zone of ZONES) {
      expect(isTimeZone(zone)).toBe(true);
      zonedParts(MOMENT, zone);
      momentText(MOMENT, { tz: zone, year: true, weekday: true });
      timeOfDayText(MOMENT, zone);
    }
    const sizes = zoneCacheSizes();
    expect(sizes.zoneChecks).toBe(ZONE_CACHE_MAX);
    expect(sizes.partFormatters).toBe(ZONE_CACHE_MAX);
    expect(sizes.textFormatters).toBe(ZONE_CACHE_MAX);
  });

  it('still answers a zone evicted from the cache, and a cached one', () => {
    for (const zone of ZONES) isTimeZone(zone);
    // The first zone was evicted long ago: checked afresh, still known.
    expect(isTimeZone(ZONES[0]!)).toBe(true);
    expect(isTimeZone(ZONES[0]!)).toBe(true);
    expect(zonedParts(MOMENT, 'UTC')).toEqual({
      year: 2026,
      month: 9,
      date: 31,
      hour: 17,
      minute: 0,
    });
    expect(zoneCacheSizes().zoneChecks).toBeLessThanOrEqual(ZONE_CACHE_MAX);
  });
});
