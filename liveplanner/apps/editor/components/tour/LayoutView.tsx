'use client';

// Layout View, the Dashboards track (docs/specs/026-plan/plan-tour.md "Dashboards: Layout View"): while it runs the
// dashboard shows how it is built, as a design tool's layout grid does: each row's twelve column guides, each slot's
// span (8 / 12) and each row's height, the dividers and edges drawn as on hover. The overlay takes no pointer, so the
// page is used as ever; the mission strip asks for one change at a time and ticks it off as the person makes it.

import { useEffect, useMemo, useState } from 'react';
import { DASHBOARD_GAP_PX, DASHBOARD_SPANS, type DashboardLayout } from '@liveplanner/project';
import { Button, Portal } from '@liveplanner/ui';
import { helpArticleHref } from '@/lib/help-articles';
import { LearnMore } from './LearnMore';
import { LAYOUT_VIEW_REVEAL, layoutMissions, type LayoutCtx } from './layout-missions';
import { MissionStrip } from './MissionStrip';
import { useMissions } from './missions';

// The page width under which a dashboard stacks its rows (condense.ts DASHBOARD_CONDENSE_PX).
const CONDENSED_PX = 640;
// How often the overlay re-measures the page (as a tour's ring does).
const TRACK_MS = 150;

type RowBox = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  slots: { id: string; left: number; top: number; span: number }[];
  heightPx: number;
  fill: boolean;
};

// Where each row and slot is on screen now, with its span and height from the layout: two queries a measure, however
// many rows and slots.
function measure(layout: DashboardLayout): RowBox[] {
  const rects = (attr: string) => {
    const out = new Map<string, DOMRect>();
    for (const el of document.querySelectorAll<HTMLElement>(`[${attr}]`))
      out.set(el.getAttribute(attr) ?? '', el.getBoundingClientRect());
    return out;
  };
  const rowRects = rects('data-dashboard-row');
  const slotRects = rects('data-dashboard-slot');
  const out: RowBox[] = [];
  for (const row of layout.rows) {
    const r = rowRects.get(row.id);
    if (!r || r.width === 0) continue;
    out.push({
      id: row.id,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      heightPx: row.height,
      fill: row.fill === true,
      slots: row.slots.flatMap((s) => {
        const sr = slotRects.get(s.id);
        return sr ? [{ id: s.id, left: sr.left, top: sr.top, span: s.span }] : [];
      }),
    });
  }
  return out;
}

const sameBoxes = (a: RowBox[], b: RowBox[]) => JSON.stringify(a) === JSON.stringify(b);

export function LayoutView({
  layout,
  onEnd,
}: {
  layout: DashboardLayout;
  onEnd: (outcome: 'completed' | 'skipped') => void;
}) {
  // The layout and the page's width as the tour started: the missions are fixed from them.
  const [start] = useState(layout);
  const [condensed] = useState(() => {
    const page = document.querySelector('[data-dashboard]')?.getBoundingClientRect().width;
    return page !== undefined && page < CONDENSED_PX;
  });
  const missions = useMemo(() => layoutMissions(start, condensed), [start, condensed]);
  const ctx: LayoutCtx = useMemo(() => ({ start, now: layout }), [start, layout]);
  const run = useMissions({ missions, ctx, active: true });

  // The page's dividers and edges stay shown, and a filled slot's cog with them (its Add a Slot), while it runs.
  useEffect(() => {
    const page = document.querySelector<HTMLElement>('[data-dashboard]');
    page?.setAttribute('data-layout-view', '');
    const slot = document.querySelector<HTMLElement>(LAYOUT_VIEW_REVEAL);
    if (slot) slot.dataset.tourReveal = '';
    return () => {
      page?.removeAttribute('data-layout-view');
      if (slot) delete slot.dataset.tourReveal;
    };
  }, []);

  const [boxes, setBoxes] = useState<RowBox[]>([]);
  useEffect(() => {
    const tick = () =>
      setBoxes((prev) => {
        const next = measure(layout);
        return sameBoxes(prev, next) ? prev : next;
      });
    tick();
    const id = window.setInterval(tick, TRACK_MS);
    window.addEventListener('scroll', tick, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('scroll', tick, true);
    };
  }, [layout]);

  return (
    <>
      <Portal>
        <div
          aria-hidden
          data-layout-view-overlay=""
          className="pointer-events-none fixed inset-0 z-[var(--z-overlay)]"
        >
          {boxes.map((row) => (
            <RowGuides key={row.id} row={row} condensed={condensed} />
          ))}
        </div>
      </Portal>
      <MissionStrip
        name="Layout View"
        run={run}
        onEnd={() => onEnd('skipped')}
        finish={
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
                That’s the grid.
              </h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                {condensed
                  ? 'On a wider screen, slots sit side by side and you can drag between them.'
                  : 'Dashboard Settings starts you from another layout any time.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => onEnd('completed')}>
                Done
              </Button>
              <span className="flex-1" />
              <LearnMore href={helpArticleHref('planDashboards')} />
            </div>
          </div>
        }
      />
    </>
  );
}

// One row's layout grid: its twelve columns as faint bands, each slot's span, and the row's height by its edge. On a
// phone the rows stack, so only the spans show, as a wider screen lays them out.
function RowGuides({ row, condensed }: { row: RowBox; condensed: boolean }) {
  const column = (row.width + DASHBOARD_GAP_PX) / DASHBOARD_SPANS - DASHBOARD_GAP_PX;
  return (
    <>
      {condensed ? null : (
        <div
          className="absolute flex animate-fade-in"
          style={{
            left: row.left,
            top: row.top,
            width: row.width,
            height: row.height,
            gap: DASHBOARD_GAP_PX,
          }}
        >
          {Array.from({ length: DASHBOARD_SPANS }, (_, i) => (
            <span
              key={i}
              className="h-full rounded-[3px] border-x border-dashed border-brand-500/30 bg-brand-500/[0.045] dark:border-brand-400/35 dark:bg-brand-400/[0.06]"
              style={{ width: column }}
            />
          ))}
        </div>
      )}
      {row.slots.map((s) => (
        <span
          key={`${s.id}:${s.span}`}
          data-layout-span=""
          // On the slot's top edge, like a frame's label in a design tool: never over the slot's own title.
          className="absolute -translate-y-1/2 animate-fade-in whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none tabular-nums text-white shadow-[0_1px_2px_rgba(15,23,42,0.25)] dark:bg-white dark:text-slate-900"
          style={{ left: s.left + 10, top: s.top }}
        >
          {s.span} / {DASHBOARD_SPANS}
        </span>
      ))}
      {condensed || row.fill ? null : (
        <span
          key={`${row.id}:${row.heightPx}`}
          data-layout-height=""
          className="absolute -translate-x-full -translate-y-full animate-fade-in whitespace-nowrap rounded-md bg-brand-700 px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-white shadow-[0_1px_2px_rgba(15,23,42,0.25)] dark:bg-brand-600"
          style={{ left: row.left + row.width - 8, top: row.top + row.height - 8 }}
        >
          {row.heightPx} px
        </span>
      )}
    </>
  );
}
