import { describe, expect, it } from 'vitest';
import { telemetryEventCheck } from './event-check';

const check = telemetryEventCheck({
  categories: ['Element', 'Page', 'Cta', 'Timing'] as const,
  actions: ['Added', 'View', 'Opened', 'Created', 'Measured'] as const,
  isValidPageViewPath: (path) => path === '/pricing',
  isCtaSource: (value) => value === 'Hero',
  isTimingType: (type) => type === 'Load.Fast',
});

describe('telemetryEventCheck', () => {
  it('takes an event in the vocabulary, with or without a safe type', () => {
    expect(check({ category: 'Element', action: 'Added' })).toBe(true);
    expect(check({ category: 'Element', action: 'Added', type: null })).toBe(true);
    expect(check({ category: 'Element', action: 'Added', type: 'Square' })).toBe(true);
  });

  it('refuses anything outside the vocabulary or not an object', () => {
    expect(check(null)).toBe(false);
    expect(check('Element')).toBe(false);
    expect(check({ category: 'Nope', action: 'Added' })).toBe(false);
    expect(check({ category: 'Element', action: 'Nope' })).toBe(false);
    expect(check({ category: 'Element', action: 'Added', type: 'free text, with <html>' })).toBe(
      false,
    );
    expect(check({ category: 'Element', action: 'Added', type: 3 })).toBe(false);
  });

  it('holds a page view, a CTA and a timing to their own checks', () => {
    expect(check({ category: 'Page', action: 'View', type: '/pricing' })).toBe(true);
    expect(check({ category: 'Page', action: 'View', type: '/nope' })).toBe(false);
    expect(check({ category: 'Page', action: 'View' })).toBe(false);
    expect(check({ category: 'Page', action: 'Added', type: '/pricing' })).toBe(false);
    expect(check({ category: 'Cta', action: 'Opened', type: 'Hero' })).toBe(true);
    expect(check({ category: 'Cta', action: 'Created', type: 'Hero' })).toBe(true);
    expect(check({ category: 'Cta', action: 'Opened', type: 'Other' })).toBe(false);
    expect(check({ category: 'Cta', action: 'Added', type: 'Hero' })).toBe(false);
    expect(check({ category: 'Timing', action: 'Measured', type: 'Load.Fast' })).toBe(true);
    expect(check({ category: 'Timing', action: 'Measured', type: 'Load' })).toBe(false);
    expect(check({ category: 'Timing', action: 'Added', type: 'Load.Fast' })).toBe(false);
  });
});
