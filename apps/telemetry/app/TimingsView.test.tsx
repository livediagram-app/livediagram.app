// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { metricKey, type TelemetrySummary } from '@livediagram/api-schema';
import { TimingsView } from './TimingsView';

// The Timings tab (docs/specs/017-telemetry/timing-telemetry.md): editor timings as percentiles, Web
// Vitals rated, and a window with too few timings says so rather than quoting a percentile.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const timing = (type: string, count: number) => ({
  category: 'Timing',
  action: 'Measured',
  type,
  count,
});

function summary(daily = true): TelemetrySummary {
  const rows = [
    timing('DocumentLoad.Under1000ms', 40),
    timing('Save.Under250ms', 3),
    timing('Lcp.Marketing.Under2500ms', 30),
    timing('Inp.Marketing.Under500ms', 30),
    timing('Cls.Marketing.Over0p5', 30),
  ];
  const window = { total: 133, rows };
  return {
    enabled: true,
    generatedAt: 1,
    windows: { today: window, last7: window, last30: window },
    daily: daily
      ? {
          days: [0, 1, 2],
          totals: [0, 0, 0],
          byCategory: {},
          byMetric: {
            [metricKey('Timing', 'Measured', 'DocumentLoad.Under1000ms')]: [20, 0, 20],
            [metricKey('Timing', 'Measured', 'DocumentLoad.Under2000ms')]: [0, 0, 20],
            [metricKey('Timing', 'Measured', 'Save.Under250ms')]: [5, 5, 0],
          },
        }
      : undefined,
  };
}

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

function render(s: TelemetrySummary) {
  const host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  act(() => root!.render(<TimingsView summary={s} active="last7" />));
  return host;
}

const card = (host: HTMLElement, title: string) =>
  [...host.querySelectorAll('div.rounded-2xl')].find(
    (el) => el.querySelector('p')?.textContent === title,
  )!;

describe('TimingsView', () => {
  it('shows each editor timing as its estimated percentiles', () => {
    const host = render(summary());
    const load = card(host, 'Document Load');
    expect(load.textContent).toContain('875 ms'); // p75 of 500..1000
    expect(load.textContent).toContain('Median 750 ms · p95 975 ms');
    expect(load.textContent).toContain('40 timings');
    expect(load.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain(
      'under 1 s: 40',
    );
    expect(load.textContent).toContain('Daily p75');
  });

  it('says a window with too few timings is too few to read', () => {
    const save = card(render(summary()), 'Save');
    expect(save.textContent).toContain('Fewer than 20 timings');
    expect(save.textContent).not.toContain('Median');
  });

  it("rates each app's vitals, the word always beside the colour", () => {
    const marketing = card(render(summary()), 'Marketing');
    const text = marketing.textContent!;
    expect(text).toMatch(/LCP.*2.3 s.*Good/);
    expect(text).toMatch(/INP.*450 ms.*Needs Work/);
    expect(text).toMatch(/CLS.*over 0.50.*Poor/);
  });

  it('leaves an app with no pages yet unrated', () => {
    const help = card(render(summary()), 'Help');
    expect(help.textContent).toContain('Too few');
    expect(help.textContent).not.toMatch(/Good|Poor|Needs Work/);
  });

  it('renders without the daily series from an older api', () => {
    const host = render(summary(false));
    expect(card(host, 'Document Load').textContent).not.toContain('Daily p75');
  });
});
