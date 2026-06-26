import type { PanelCorner } from '@/lib/panel-layout';
import { PANEL_CORNERS } from '@/lib/panel-layout';

// Drag-time corner targets for panel docking (spec/63). Rendered by
// CanvasChrome only while a panel is being dragged on desktop, on a
// pointer-inert layer over the canvas. Each corner shows a faint
// drop target; the corner the panel would snap to if released now
// (`candidate`) lights up in the brand colour and grows, so the user
// sees where the panel will land before letting go. Releasing away
// from every target is a free drop (no corner lit).
export function PanelSnapGuides({ candidate }: { candidate: PanelCorner | null }) {
  return (
    // inset matches the resting corner inset (CORNER_INSET_PX / `*-4`),
    // so a lit target sits exactly where the docked panel's corner lands.
    <div className="pointer-events-none absolute inset-4 z-[var(--z-panel)]" aria-hidden>
      {PANEL_CORNERS.map((corner) => (
        <CornerTarget key={corner} corner={corner} active={corner === candidate} />
      ))}
    </div>
  );
}

const CORNER_POSITION: Record<PanelCorner, string> = {
  'top-left': 'left-0 top-0',
  'top-right': 'right-0 top-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-right': 'bottom-0 right-0',
};

function CornerTarget({ corner, active }: { corner: PanelCorner; active: boolean }) {
  return (
    <div
      className={`absolute h-16 w-16 rounded-xl border-2 border-dashed transition-all duration-150 ${
        CORNER_POSITION[corner]
      } ${
        active
          ? 'scale-110 border-brand-500 bg-brand-500/10 dark:border-brand-400 dark:bg-brand-400/10'
          : 'border-slate-300/70 bg-slate-400/5 dark:border-slate-600/70'
      }`}
    />
  );
}
