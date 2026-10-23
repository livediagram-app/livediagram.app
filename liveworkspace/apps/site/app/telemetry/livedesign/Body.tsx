'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TelemetrySummary, TelemetryWindowKey } from '@livedesign/api-schema';
import { AlertGlyph, LayersGlyph, SearchGlyph, SparkGlyph, WindowGlyph } from './glyphs';
import { WindowPanel } from './WindowPanel';
import { StickyWindowBar } from './StickyWindowBar';
import { ViewTabs } from './ViewTabs';
import { ActiveView, prefetchViews } from './ActiveView';
import { SECTION_TAB, type SectionKey, type ViewKey } from './view-keys';
import type { SectionFocus } from './SectionedView';
import { dropRetiredEvents } from './retired-events';

// livedesign.app's own dashboard (liveworkspace/docs/telemetry.md "The dashboard"): the key metrics
// first, then the three Detail tabs (each gathering what were separate tabs until October 2026 as
// sections): what people build with (Features), how they find their way (Pages & Help), and whether
// it all works and is fast (Health). Search is the power-user lens.
const VIEWS: { key: ViewKey; label: string; icon: ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <SparkGlyph /> },
  { key: 'features', label: 'Features', icon: <LayersGlyph /> },
  { key: 'pages', label: 'Pages & Help', icon: <WindowGlyph /> },
  { key: 'health', label: 'Health', icon: <AlertGlyph /> },
  { key: 'search', label: 'Search', icon: <SearchGlyph /> },
];

export function Body({ summary: raw }: { summary: TelemetrySummary }) {
  // Retired features never render (see retired-events.ts).
  const summary = useMemo(() => dropRetiredEvents(raw), [raw]);
  const [view, setView] = useState<ViewKey>('dashboard');
  // A link into a section of another tab (a stack's See also): switch to its
  // tab, and the tab scrolls the section in once it renders (SectionedView).
  const [focus, setFocus] = useState<SectionFocus | null>(null);
  const openSection = useCallback((section: SectionKey) => {
    setView(SECTION_TAB[section]);
    setFocus((prev) => ({ section, n: (prev?.n ?? 0) + 1 }));
  }, []);
  // Picking a tab by hand starts at its top, never at a section asked for earlier.
  const selectView = (next: ViewKey) => {
    setFocus(null);
    setView(next);
  };
  const [active, setActive] = useState<TelemetryWindowKey>('last7');
  // The tab redraws for a new window in the background (see ActiveView), so the
  // click paints the selector straight away; the tab dims until it catches up.
  const shownWindow = useDeferredValue(active);
  // Watched by the StickyWindowBar: once this panel scrolls under the header,
  // the condensed timeframe selector fades in.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => prefetchViews(), []);

  return (
    <>
      {/* Global timeframe selector + 30-day trend line. Shared by every
          tab and always visible, so the window the cards pick drives
          the counts in every view below. */}
      <div ref={panelRef} className="mt-10">
        <WindowPanel
          totals={{
            today: summary.windows.today.total,
            last7: summary.windows.last7.total,
            last30: summary.windows.last30.total,
          }}
          daily={summary.daily}
          active={active}
          onSelect={setActive}
        />
      </div>
      <StickyWindowBar
        watchRef={panelRef}
        active={active}
        onSelect={setActive}
        views={VIEWS}
        view={view}
        onSelectView={(k) => selectView(k as ViewKey)}
      />

      {/* View tabs — a single-line carousel; chevrons appear when the
          full set overflows the column (see ViewTabs). */}
      <ViewTabs views={VIEWS} leads={['dashboard', 'search']} view={view} onSelect={selectView} />

      <div
        aria-busy={shownWindow !== active}
        className={
          'transition-opacity duration-short ' + (shownWindow !== active ? 'opacity-60' : '')
        }
      >
        <ActiveView
          view={view}
          summary={summary}
          active={shownWindow}
          focus={focus}
          onOpenSection={openSection}
        />
      </div>
    </>
  );
}
