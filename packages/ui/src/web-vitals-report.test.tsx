// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportWebVital, webVitalApp, webVitalOf } from './web-vitals-report';

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

describe('webVitalOf', () => {
  it('reads the three Core Web Vitals and nothing else', () => {
    expect(webVitalOf('LCP')).toBe('Lcp');
    expect(webVitalOf('INP')).toBe('Inp');
    expect(webVitalOf('CLS')).toBe('Cls');
    expect(webVitalOf('FCP')).toBeNull();
    expect(webVitalOf('TTFB')).toBeNull();
    expect(webVitalOf('FID')).toBeNull();
  });
});

describe('webVitalApp', () => {
  it('names the app that serves the page', () => {
    expect(webVitalApp('/')).toBe('Marketing');
    expect(webVitalApp('/document/abc-123')).toBe('Live');
    expect(webVitalApp('/help/canvas/the-canvas')).toBe('Help');
    expect(webVitalApp('/telemetry')).toBe('Dashboard');
    expect(webVitalApp('/community')).toBe('Community');
  });
});

describe('reportWebVital', () => {
  it('sends a vital as its app and bucket', () => {
    const track = vi.fn();
    reportWebVital(track, { name: 'LCP', value: 1800 }, 'Marketing');
    reportWebVital(track, { name: 'CLS', value: 0.02 }, 'Help');
    reportWebVital(track, { name: 'TTFB', value: 90 }, 'Help');
    expect(track.mock.calls).toEqual([
      ['Timing', 'Measured', 'Lcp.Marketing.Under2500ms'],
      ['Timing', 'Measured', 'Cls.Help.Under0p05'],
    ]);
  });
});

describe('WebVitalsReporter', () => {
  it('reports each vital against the app the page loaded in', async () => {
    window.history.replaceState(null, '', '/help/canvas/the-canvas');
    const { default: WebVitalsReporter } = await import('./WebVitalsReporter');
    const track = vi.fn();
    render(<WebVitalsReporter track={track} />);
    // An in-app navigation later still reports the app of the full page load.
    window.history.replaceState(null, '', '/help/other');
    reported.fn!({ name: 'INP', value: 120 });
    expect(track).toHaveBeenCalledWith('Timing', 'Measured', 'Inp.Help.Under200ms');
  });
});
