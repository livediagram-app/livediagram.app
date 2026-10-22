'use client';

// A palette tile pressed on a Dashboard (docs/specs/026-plan/plan-tabs.md "Filling a slot"): rather than landing at a
// default, it waits for a click. Every place it could go is drawn faintly (dashboardCandidates), the one under the
// pointer strongly, under a banner saying "Click where the <name> goes"; a click places it there (one step), Escape or
// Cancel puts it away, and pressing another tile swaps it. From the keyboard, Enter or Space places it where a press
// with no pointer would (the first empty slot; a row at the foot, a slot in the last row with room), and says where
// it went.
import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { DASHBOARD_SLOTS_MAX, type Tab } from '@liveplanner/project';
import {
  dashboardCandidates,
  dashboardZone,
  readDashboardGeometry,
  type DashboardItem,
  type DashboardZone,
  type ZoneAllowed,
} from '@/hooks/plan/dashboard-drop';
import { DropZoneMark, sameZone, zoneMark, type ZoneMark } from './drop-zone-mark';
import { announce } from '@/lib/announcer';
import {
  DASHBOARD_CARD_NAMES,
  DASHBOARD_ROW_TILES,
  FORM_METRIC_NAMES,
  SHEET_CHART_NAME,
  SHEET_METRIC_NAMES,
} from '@/components/palette/palette-dashboard-tiles';

// What the banner calls the armed item.
function armedName(item: DashboardItem, tabs: readonly Tab[]): string {
  switch (item.kind) {
    case 'row': {
      const tile = DASHBOARD_ROW_TILES.find((r) => r.slots === item.slots && r.id);
      return tile?.caption ?? 'Row';
    }
    case 'slot':
      return 'Slot';
    case 'board':
      return 'Board';
    case 'sheet':
      return 'Sheet';
    case 'note':
      return 'Note';
    case 'card':
      return DASHBOARD_CARD_NAMES[item.card];
    case 'sheet-metric':
      return SHEET_METRIC_NAMES[item.metric];
    case 'form-metric':
      return FORM_METRIC_NAMES[item.metric];
    case 'sheet-chart':
      return SHEET_CHART_NAME;
    case 'tab':
      return tabs.find((t) => t.id === item.tabId)?.name ?? 'Tab';
    case 'view':
      return item.view.startsWith('metric:') ? 'Metric' : 'Chart';
  }
}

type Hover = { zone: DashboardZone; mark: ZoneMark };

// What is said once Enter places it.
function placedLine(item: DashboardItem, tabs: readonly Tab[]): string {
  const name = armedName(item, tabs);
  if (item.kind === 'row') return `${name} added at the foot of the dashboard`;
  if (item.kind === 'slot') return 'Slot added to the last row with room';
  return `${name} placed in the first empty slot`;
}

export function useArmedPlacement({
  pageRef,
  tabs,
  place,
  allowFor,
}: {
  pageRef: RefObject<HTMLDivElement | null>;
  tabs: readonly Tab[];
  // The zones a Layout tile may take without squeezing anything (useFitGuard).
  allowFor: (item: DashboardItem) => ZoneAllowed | undefined;
  // Null: where a press with no pointer puts it (usePlanTabActions.placeItem).
  place: (item: DashboardItem, zone: DashboardZone | null) => void;
}) {
  const [armed, setArmed] = useState<DashboardItem | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [marks, setMarks] = useState<ZoneMark[]>([]);
  const disarm = useCallback(() => {
    setArmed(null);
    setHover(null);
    setMarks([]);
  }, []);
  const arm = useCallback(
    (item: DashboardItem) => {
      const root = pageRef.current;
      if (!root) return;
      const geo = readDashboardGeometry(root);
      const page = root.getBoundingClientRect();
      setArmed(item);
      setHover(null);
      setMarks(
        dashboardCandidates(item, geo, DASHBOARD_SLOTS_MAX, allowFor(item)).map((z) =>
          zoneMark(z, geo, page, root.scrollTop),
        ),
      );
    },
    [pageRef, allowFor],
  );
  // Escape puts it away, and Enter or Space places it, before anything else on the page hears them. Not while typing,
  // nor on the banner's own Cancel.
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        disarm();
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest('[data-armed-banner], input, textarea, select, [contenteditable="true"]'))
        return;
      e.preventDefault();
      e.stopPropagation();
      place(armed, null);
      announce(placedLine(armed, tabs));
      disarm();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [armed, disarm, place, tabs]);
  const zoneAt = (x: number, y: number): Hover | null => {
    const root = pageRef.current;
    if (!armed || !root) return null;
    const geo = readDashboardGeometry(root);
    const z = dashboardZone(armed, geo, x, y, allowFor(armed));
    return z
      ? { zone: z, mark: zoneMark(z, geo, root.getBoundingClientRect(), root.scrollTop) }
      : null;
  };
  const measure = (item: DashboardItem) => {
    const root = pageRef.current;
    if (!root) return [];
    const geo = readDashboardGeometry(root);
    const page = root.getBoundingClientRect();
    return dashboardCandidates(item, geo, DASHBOARD_SLOTS_MAX, allowFor(item)).map((z) =>
      zoneMark(z, geo, page, root.scrollTop),
    );
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!armed) return;
    // The page may have scrolled or reflowed (a slot loading) since the zones were drawn.
    const fresh = measure(armed);
    setMarks((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
    const next = zoneAt(e.clientX, e.clientY);
    setHover((prev) => (!next ? null : prev && sameZone(prev.zone, next.zone) ? prev : next));
  };
  // The click that places it: taken before the slot under it sees it.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!armed) return;
    if ((e.target as HTMLElement).closest('[data-armed-banner]')) return;
    e.preventDefault();
    e.stopPropagation();
    const at = zoneAt(e.clientX, e.clientY);
    if (!at) return;
    place(armed, at.zone);
    disarm();
  };
  const overlay = armed ? (
    <>
      {marks.map((m, i) => (
        <DropZoneMark key={i} mark={m} faint />
      ))}
      {hover ? <DropZoneMark mark={hover.mark} /> : null}
      {/* Takes no room on the page (a zero-height sticky row), so the slots stay where the zones were measured. */}
      <div className="pointer-events-none sticky top-0 z-30 flex h-0 justify-center">
        <div
          data-armed-banner=""
          role="status"
          className="pointer-events-auto mt-1 flex h-fit w-fit items-center gap-3 rounded-full border border-brand-200 bg-white/95 py-1.5 pl-4 pr-1.5 text-[13px] text-slate-700 shadow-lg dark:border-brand-500/40 dark:bg-slate-900/95 dark:text-slate-200"
        >
          <span>
            Click where the <strong className="font-semibold">{armedName(armed, tabs)}</strong> goes
            <span className="text-slate-500 dark:text-slate-400">
              {armed.kind === 'row'
                ? ', or press Enter for the foot'
                : armed.kind === 'slot'
                  ? ', or press Enter for the last row with room'
                  : ', or press Enter for the first empty slot'}
            </span>
          </span>
          <button
            type="button"
            onClick={disarm}
            className="cursor-pointer rounded-full px-3 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  ) : null;
  return { armed, arm, disarm, overlay, onPointerMove, onClickCapture };
}
