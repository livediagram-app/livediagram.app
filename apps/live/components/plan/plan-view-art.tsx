// The Visualisations tiles' glyphs (docs/specs/026-plan/plan-views.md "Visualisations"): each a small
// picture of its chart, on the 22-unit grid the other Plan glyphs use.
import { Glyph } from '@livediagram/ui';
import type { PlanVisualisation } from '@livediagram/items';

const VIEW_ART: Record<PlanVisualisation, React.ReactNode> = {
  // Staggered bars on a time axis, a milestone at the end.
  gantt: (
    <>
      <path d="M3 3v16.5h16.5" />
      <rect x="5.5" y="5" width="7" height="2.75" rx="1" />
      <rect x="9" y="9.75" width="8" height="2.75" rx="1" />
      <path d="M15.5 16.25l1.6-1.6 1.6 1.6-1.6 1.6Z" />
    </>
  ),
  // A month page: rings, a header band and a grid of days.
  calendar: (
    <>
      <rect x="2.5" y="4" width="17" height="15" rx="2" />
      <path d="M2.5 8.5h17M7 2.5v3M15 2.5v3M7 12h1M11 12h1M15 12h1M7 15.5h1M11 15.5h1" />
    </>
  ),
  // A person beside a long bar and a short one.
  workload: (
    <>
      <circle cx="5" cy="6.5" r="2" />
      <path d="M2 12.5a3 3 0 0 1 6 0" />
      <rect x="10" y="5" width="9.5" height="3" rx="1" />
      <rect x="10" y="10.5" width="5.5" height="3" rx="1" />
      <path d="M2.5 17.5h17" />
    </>
  ),
  // A donut with a slice taken out.
  'status-mix': (
    <>
      <circle cx="11" cy="11" r="8" />
      <circle cx="11" cy="11" r="3.5" />
      <path d="M11 3v4.5M18.5 13.5l-4.2-1.4" />
    </>
  ),
  // A three by three grid of cells, two filled in.
  'priority-matrix': (
    <>
      <rect x="2.5" y="2.5" width="17" height="17" rx="2" />
      <path d="M8.2 2.5v17M13.8 2.5v17M2.5 8.2h17M2.5 13.8h17" />
      <rect x="9.5" y="3.8" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="15.1" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" />
    </>
  ),
  // A filter bar over a list of cards, a magnifier at its end.
  search: (
    <>
      <rect x="2.5" y="3" width="11" height="3.5" rx="1.75" />
      <circle cx="17" cy="4.75" r="2.25" />
      <path d="M18.6 6.4l1.4 1.4M2.5 11h17M2.5 15h12M2.5 19h15" />
    </>
  ),
};

export function PlanViewArt({ view, size = 18 }: { view: PlanVisualisation; size?: number }) {
  return (
    <Glyph size={size} units={22}>
      {VIEW_ART[view]}
    </Glyph>
  );
}
