// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebVitalsReport } from './web-vitals';
import { WebVitalsReporter } from './WebVitalsReporter';

const reported = vi.hoisted(() => ({
  fn: null as null | ((m: { name: string; value: number }) => void),
}));
vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (fn: (m: { name: string; value: number }) => void) => {
    reported.fn = fn;
  },
}));

afterEach(() => {
  reported.fn = null;
});

// A product's binding: its vitals, its apps (here the first path segment) and a reportTiming that buckets
// nothing, so what reaches it is plain.
const timings: [string, number][] = [];
const report = createWebVitalsReport({
  vitals: ['Lcp', 'Inp', 'Cls'] as const,
  appOf: (pathname) => (pathname.split('/')[1] || 'home').toUpperCase(),
  reportTiming: (_track, metric, value) => {
    timings.push([metric, value]);
  },
});

afterEach(() => {
  timings.length = 0;
});

describe('webVitalOf', () => {
  it('reads the three Core Web Vitals and nothing else', () => {
    expect(report.webVitalOf('LCP')).toBe('Lcp');
    expect(report.webVitalOf('INP')).toBe('Inp');
    expect(report.webVitalOf('CLS')).toBe('Cls');
    expect(report.webVitalOf('FCP')).toBeNull();
    expect(report.webVitalOf('TTFB')).toBeNull();
    expect(report.webVitalOf('FID')).toBeNull();
  });
});

describe('reportWebVital', () => {
  it('sends a vital it reports as `<Vital>.<App>`, and nothing for the rest', () => {
    const track = vi.fn();
    report.reportWebVital(track, { name: 'LCP', value: 1800 }, 'Marketing');
    report.reportWebVital(track, { name: 'CLS', value: 0.02 }, 'Help');
    report.reportWebVital(track, { name: 'TTFB', value: 90 }, 'Help');
    expect(timings).toEqual([
      ['Lcp.Marketing', 1800],
      ['Cls.Help', 0.02],
    ]);
  });
});

describe('WebVitalsReporter', () => {
  it('reports each vital against the app the page loaded in', () => {
    window.history.replaceState(null, '', '/help/canvas/the-canvas');
    render(<WebVitalsReporter track={vi.fn()} report={report} />);
    // An in-app navigation later still reports the app of the full page load.
    window.history.replaceState(null, '', '/other');
    reported.fn!({ name: 'INP', value: 120 });
    expect(timings).toEqual([['Inp.HELP', 120]]);
  });
});
