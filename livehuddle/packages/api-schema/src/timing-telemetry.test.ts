import { describe, expect, it } from 'vitest';
import { isValidTelemetryEvent, TELEMETRY_TYPE_PATTERN } from './telemetry-schema';
import {
  ALL_TIMING_TYPES,
  EDITOR_TIMING_METRICS,
  isTimingType,
  parseTimingType,
  TIMING_METRICS,
  TIMING_SCALES,
  timingBucket,
  timingBuckets,
  timingType,
  timingTypesOf,
  WEB_VITAL_APPS,
  WEB_VITAL_THRESHOLDS,
  WEB_VITALS,
} from './timing-telemetry';

describe('timing buckets', () => {
  it('put a value in the first bucket whose bound it is under', () => {
    expect(timingBucket('Duration', 0)).toBe('Under100ms');
    expect(timingBucket('Duration', 99.9)).toBe('Under100ms');
    expect(timingBucket('Duration', 100)).toBe('Under250ms');
    expect(timingBucket('Duration', 999)).toBe('Under1000ms');
    expect(timingBucket('Duration', 29_999)).toBe('Under30000ms');
  });

  it('put anything past the last bound in the open Over bucket', () => {
    expect(timingBucket('Duration', 30_000)).toBe('Over30000ms');
    expect(timingBucket('Duration', 10 * 60_000)).toBe('Over30000ms');
  });

  it('spell a fractional CLS bound with p for its point', () => {
    expect(timingBucket('Cls', 0)).toBe('Under0p01');
    expect(timingBucket('Cls', 0.07)).toBe('Under0p1');
    expect(timingBucket('Cls', 0.3)).toBe('Under0p5');
    expect(timingBucket('Cls', 2)).toBe('Over0p5');
  });

  it('chain each bucket from the one before, the last open', () => {
    for (const scale of Object.keys(TIMING_SCALES) as (keyof typeof TIMING_SCALES)[]) {
      const buckets = timingBuckets(scale);
      expect(buckets).toHaveLength(TIMING_SCALES[scale].bounds.length + 1);
      expect(buckets[0]!.lower).toBe(0);
      for (let i = 1; i < buckets.length; i++) {
        expect(buckets[i]!.lower).toBe(buckets[i - 1]!.upper);
      }
      expect(buckets.at(-1)!.upper).toBeNull();
    }
  });

  it('have ascending bounds on every scale', () => {
    for (const { bounds } of Object.values(TIMING_SCALES)) {
      expect([...bounds].sort((a, b) => a - b)).toEqual([...bounds]);
    }
  });

  it("put Google's Web Vitals thresholds exactly on a bound", () => {
    for (const vital of WEB_VITALS) {
      const bounds: readonly number[] = TIMING_SCALES[vital].bounds;
      expect(bounds).toContain(WEB_VITAL_THRESHOLDS[vital].good);
      expect(bounds).toContain(WEB_VITAL_THRESHOLDS[vital].poor);
    }
  });
});

describe('timingType', () => {
  it('joins the metric and its bucket', () => {
    expect(timingType('DocumentLoad', 812)).toBe('DocumentLoad.Under1000ms');
    expect(timingType('Lcp.Marketing', 2600)).toBe('Lcp.Marketing.Under4000ms');
    expect(timingType('Cls.Help', 0.02)).toBe('Cls.Help.Under0p05');
  });

  it('drops an unknown metric or a value that is not a real duration', () => {
    expect(timingType('Nope', 10)).toBeNull();
    expect(timingType('Save', -1)).toBeNull();
    expect(timingType('Save', Number.NaN)).toBeNull();
    expect(timingType('Save', Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('parseTimingType', () => {
  it('splits a type back into its metric and bucket', () => {
    expect(parseTimingType('Inp.Live.Under200ms')).toMatchObject({
      metric: 'Inp.Live',
      scale: 'Inp',
      bucket: { token: 'Under200ms', lower: 100, upper: 200 },
    });
  });

  it("rejects a bucket from another metric's scale, or no bucket at all", () => {
    expect(parseTimingType('Save.Under200ms')).toBeNull(); // an Inp bound
    expect(parseTimingType('Save')).toBeNull();
    expect(parseTimingType('.Under100ms')).toBeNull();
    expect(parseTimingType(null)).toBeNull();
  });
});

describe('the timing vocabulary', () => {
  it('names every editor metric and every app for every vital', () => {
    expect(TIMING_METRICS.size).toBe(EDITOR_TIMING_METRICS.length + 3 * WEB_VITAL_APPS.length);
    expect(timingTypesOf('Save')).toHaveLength(10);
    expect(timingTypesOf('Unknown')).toEqual([]);
  });

  it('only ever produces types the token pattern accepts', () => {
    for (const type of ALL_TIMING_TYPES) {
      expect(TELEMETRY_TYPE_PATTERN.test(type)).toBe(true);
      expect(isTimingType(type)).toBe(true);
    }
  });
});

describe('the ingest validator', () => {
  it('accepts a timing with a known metric and bucket', () => {
    expect(
      isValidTelemetryEvent({
        category: 'Timing',
        action: 'Measured',
        type: 'DocumentLoad.Under500ms',
      }),
    ).toBe(true);
  });

  it('rejects a timing with any other action, an unknown type, or none', () => {
    const base = { category: 'Timing', action: 'Measured' };
    expect(isValidTelemetryEvent({ ...base, action: 'Used', type: 'Save.Under100ms' })).toBe(false);
    expect(isValidTelemetryEvent({ ...base, type: 'Save.Under123ms' })).toBe(false);
    expect(isValidTelemetryEvent({ ...base, type: 'Anything' })).toBe(false);
    expect(isValidTelemetryEvent({ ...base, type: null })).toBe(false);
  });
});
