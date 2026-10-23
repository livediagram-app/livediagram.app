// @vitest-environment jsdom
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetrySummary } from '@livedocuments/api-schema';
import { ActiveView, prefetchViews } from './ActiveView';
import { GROUPS as DASHBOARD } from './DashboardView';
import { FeaturesView } from './FeaturesView';
import { HealthView } from './HealthView';
import * as CATALOGUE from './metric-catalogue';
import { isStack, type MetricStack } from './metric-series';
import { PagesHelpView } from './PagesHelpView';
import type { SectionFocus } from './SectionedView';
import { SECTION_TAB, sectionId, type SectionKey, type ViewKey } from './view-keys';

// Five tabs, not twelve (docs/specs/017-telemetry/telemetry.md): the Dashboard leads with the key
// metrics, the three Detail tabs gather what were separate tabs as sections, and a stack's See also
// lands on the section it names.
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
  act(() => root!.render(el));
  return host;
}

const SECTIONED: Partial<Record<ViewKey, (focus: SectionFocus | null) => ReactElement>> = {
  features: (focus) => <FeaturesView summary={SUMMARY} active="last7" focus={focus} />,
  pages: (focus) => <PagesHelpView summary={SUMMARY} active="last7" focus={focus} />,
  health: (focus) => <HealthView summary={SUMMARY} active="last7" focus={focus} />,
};

const SECTIONS = Object.keys(SECTION_TAB) as SectionKey[];

describe('the Detail tabs', () => {
  it.each(SECTIONS.filter((s) => SECTIONED[SECTION_TAB[s]]))(
    'render the %s section on the tab it maps to, with a link to it',
    (section) => {
      const el = render(SECTIONED[SECTION_TAB[section]]!(null));
      expect(el.querySelector(`#${sectionId(section)}`)).not.toBeNull();
      expect(el.querySelector(`nav a[href="#${sectionId(section)}"]`)).not.toBeNull();
    },
  );

  it('map every section to a sectioned tab', () => {
    expect(SECTIONS.filter((s) => !SECTIONED[SECTION_TAB[s]])).toEqual([]);
  });

  it('scroll an asked-for section in once, and again only when asked again', () => {
    const at = (focus: SectionFocus | null) => act(() => root!.render(SECTIONED.features!(focus)));
    render(SECTIONED.features!({ section: 'settings', n: 1 }));
    expect(scrolled).toEqual([sectionId('settings')]);
    at({ section: 'settings', n: 1 });
    expect(scrolled).toHaveLength(1);
    at({ section: 'settings', n: 2 });
    expect(scrolled).toEqual([sectionId('settings'), sectionId('settings')]);
  });

  it('scroll to a section from its link, without leaving a hash on the page', () => {
    const el = render(SECTIONED.health!(null));
    act(() =>
      el.querySelector<HTMLAnchorElement>(`nav a[href="#${sectionId('timings')}"]`)!.click(),
    );
    expect(scrolled).toEqual([sectionId('timings')]);
    expect(window.location.hash).toBe('');
  });

  it('never scroll for a section that lives on another tab', () => {
    render(SECTIONED.features!({ section: 'timings', n: 1 }));
    expect(scrolled).toEqual([]);
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

  it('links every See also to a section that exists', () => {
    const stacks = Object.values(CATALOGUE)
      .flat()
      .filter((item): item is MetricStack => typeof item === 'object' && isStack(item));
    for (const s of stacks.filter((s) => s.seeAlso)) {
      expect(SECTIONS).toContain(s.seeAlso!.section);
    }
  });
});

// A window click hands the tab a deferred window (page.tsx). Without the memo the click redraws the
// whole tab before it paints: ~190 ms on Features, ~390 ms on the old Dashboard, against ~20 ms.
describe('the active tab', () => {
  it('is memoised, so a window click paints before the tab redraws', () => {
    expect((ActiveView as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('renders the Dashboard, and says so when the api has no per-metric trends for Search', () => {
    const props = {
      summary: SUMMARY,
      active: 'last7' as const,
      focus: null,
      onOpenSection: () => {},
    };
    expect(render(<ActiveView view="dashboard" {...props} />).textContent).toContain('At a glance');
    act(() =>
      root!.render(
        <ActiveView view="search" {...props} summary={{ ...SUMMARY, daily: undefined }} />,
      ),
    );
    expect(host!.textContent).toContain('Per-metric trends aren’t available');
  });

  it.each(['features', 'pages', 'health', 'search'] as const)(
    'mounts the %s tab, whose code loads on its own',
    (view) => {
      const props = {
        summary: SUMMARY,
        active: 'last7' as const,
        focus: null,
        onOpenSection: () => {},
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
