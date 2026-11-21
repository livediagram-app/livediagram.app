// @vitest-environment jsdom
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetrySummary } from '@liveworkspace/telemetry';
import { ActiveView, prefetchViews } from './ActiveView';
import { TelemetryAppProvider, type TelemetryAppConfig } from './app';
import { AppDashboard } from './AppDashboard';
import { detailTabs, hasDetailTab } from './detail-tabs';
import { isStack, type MetricStack } from './metric-series';
import { LIVEDIAGRAM, TEST_APPS } from './test-apps';
import { DETAIL_KEYS } from './view-keys';

// The tabs (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", The tabs): the Dashboard leads
// with the key metrics, each area has a Detail tab of its own, and a stack's See also opens the tab it names.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const empty = { total: 0, rows: [] };
const SUMMARY: TelemetrySummary = {
  enabled: true,
  generatedAt: 1,
  windows: { today: empty, last7: empty, last30: empty },
  daily: { days: [0, 1, 2], totals: [0, 0, 0], byCategory: {}, byMetric: {} },
};

let root: Root | null = null;
let host: HTMLElement | null = null;
const scrolled: string[] = [];

beforeEach(() => {
  scrolled.length = 0;
  // jsdom has no layout: record which element was asked to scroll.
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this.id);
  });
  // The sticky timeframe bar watches the panel scroll away.
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(el: ReactElement): HTMLElement {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(inApp(el)));
  return host;
}

// Every app's dashboard is the same views over its own config, so each runs the same checks.
let app: TelemetryAppConfig = LIVEDIAGRAM;
const inApp = (el: ReactElement) => <TelemetryAppProvider value={app}>{el}</TelemetryAppProvider>;

describe.each(TEST_APPS)('$name', ({ config, catalogue }) => {
  const TABS = detailTabs(config);
  const DASHBOARD = config.dashboard;
  beforeEach(() => {
    app = config;
  });

  describe('the Detail tabs', () => {
    it('give each area the app has a tab of its own, in the row order, each named once', () => {
      expect(TABS.map((t) => t.key)).toEqual(DETAIL_KEYS.filter((k) => hasDetailTab(config, k)));
      expect(new Set(TABS.map((t) => t.label)).size).toBe(TABS.length);
      // One people tab, under the app's own name for it.
      expect(TABS.filter((t) => t.key === 'facilitation' || t.key === 'teamwork')).toEqual([
        expect.objectContaining({ key: config.teamwork.key, label: config.teamwork.title }),
      ]);
    });

    it('leave out a tab the app has nothing for', () => {
      expect(TABS.some((t) => t.key === 'modes')).toBe(config.modes !== undefined);
      expect(TABS.some((t) => t.key === 'explorer')).toBe(config.explorer !== undefined);
    });

    it('keep no area under another tab: the old gathered tabs are gone', () => {
      const labels = TABS.map((t) => t.label);
      for (const gone of ['Features', 'Pages & Help', 'Health']) expect(labels).not.toContain(gone);
      for (const split of [
        'Pages',
        'Help',
        'Tours & Prompts',
        'Exceptions',
        'Timings',
        'Web Vitals',
      ])
        expect(labels).toContain(split);
    });

    it('show in the tab row, and a click opens the tab', () => {
      const el = render(
        <AppDashboard app={config} summary={SUMMARY} active="last7" onSelect={() => {}} />,
      );
      const tab = (name: string) =>
        [...el.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent === name)!;
      for (const t of TABS) expect(tab(t.label)).toBeDefined();
      expect(tab('Dashboard').getAttribute('aria-selected')).toBe('true');
      act(() => tab('Tours & Prompts').click());
      expect(tab('Tours & Prompts').getAttribute('aria-selected')).toBe('true');
      expect(el.textContent).toContain('Each guided tour from offer to finish');
    });
  });

  describe('the Dashboard', () => {
    it('opens with six plain At a Glance cards', () => {
      const [first] = DASHBOARD;
      expect(first?.title).toBe('At a glance');
      expect(first?.metrics).toHaveLength(6);
      expect(first?.metrics.some(isStack)).toBe(false);
    });

    // It charted every event until October 2026 (63 stacks); the rest belong on a Detail tab.
    it('stays a short list of key stacks', () => {
      const stacks = DASHBOARD.flatMap((g) => g.metrics).filter(isStack);
      expect(stacks.length).toBeLessThanOrEqual(32);
    });

    it('opens the tab a See also names, at its top', () => {
      const el = render(
        <AppDashboard app={config} summary={SUMMARY} active="last7" onSelect={() => {}} />,
      );
      const head = [...el.querySelectorAll<HTMLElement>('[aria-expanded]')].find((b) =>
        b.textContent?.includes('Onboarding Tours'),
      )!;
      act(() => head.click());
      const link = [...document.querySelectorAll<HTMLElement>('button')].find((b) =>
        b.textContent?.includes('on the Tours & Prompts Tab'),
      )!;
      scrolled.length = 0;
      act(() => link.click());
      const selected = el.querySelector('[role="tab"][aria-selected="true"]')!;
      expect(selected.textContent).toBe('Tours & Prompts');
      // The tab's own container, once, after the switch.
      expect(scrolled.filter((id) => id === 'telemetry-tab')).toHaveLength(1);
    });

    it('links every See also to a tab the app has', () => {
      const stacks = Object.values(catalogue)
        .flat()
        .filter(
          (item): item is MetricStack =>
            typeof item === 'object' && item !== null && isStack(item as MetricStack),
        );
      for (const s of stacks.filter((s) => s.seeAlso)) {
        expect(TABS.map((t) => t.key)).toContain(s.seeAlso!.tab);
      }
    });
  });

  // A window click hands the tab a deferred window (page.tsx). Without the memo the click redraws the
  // whole tab before it paints: ~190 ms on a busy tab, ~390 ms on the old Dashboard, against ~20 ms.
  describe('the active tab', () => {
    it('is memoised, so a window click paints before the tab redraws', () => {
      expect((ActiveView as unknown as { $$typeof: symbol }).$$typeof).toBe(
        Symbol.for('react.memo'),
      );
    });

    it('renders the Dashboard, and says so when the api has no per-metric trends for Search', () => {
      const props = {
        summary: SUMMARY,
        active: 'last7' as const,
        onOpenTab: () => {},
      };
      expect(render(<ActiveView view="dashboard" {...props} />).textContent).toContain(
        'At a glance',
      );
      act(() =>
        root!.render(
          inApp(<ActiveView view="search" {...props} summary={{ ...SUMMARY, daily: undefined }} />),
        ),
      );
      expect(host!.textContent).toContain('Per-metric trends aren’t available');
    });

    it.each([...DETAIL_KEYS, 'search'] as const)(
      'mounts the %s tab, whose code loads on its own',
      (view) => {
        const props = {
          summary: SUMMARY,
          active: 'last7' as const,
          onOpenTab: () => {},
        };
        expect(() => render(<ActiveView view={view} {...props} />)).not.toThrow();
      },
    );

    it('fetches the other tabs once the browser is idle, and cancels if the page goes first', () => {
      vi.useFakeTimers();
      try {
        const idle = window.requestIdleCallback;
        // jsdom has no requestIdleCallback: the timeout path.
        (window as { requestIdleCallback?: unknown }).requestIdleCallback = undefined;
        const cancel = prefetchViews();
        cancel();
        vi.runAllTimers();
        const ran = vi.fn((cb: () => void) => {
          cb();
          return 1;
        });
        window.requestIdleCallback = ran as unknown as typeof window.requestIdleCallback;
        window.cancelIdleCallback = vi.fn();
        prefetchViews()();
        expect(ran).toHaveBeenCalledTimes(1);
        expect(window.cancelIdleCallback).toHaveBeenCalledWith(1);
        window.requestIdleCallback = idle;
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
