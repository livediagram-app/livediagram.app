import { IconButton } from '@/components/palette/palette-controls';
import type { PendingDraw } from '@/lib/draw-mode';
import type { ShapeKind } from '@livediagram/diagram';

// Data-element tiles (charts / rating / timeline rail), rendered inside
// the Tools tab's Data section. Its own file per the no-god-files rule
// — PaletteToolsTab stays the tool tiles + section layout.
export function PaletteDataTab({
  pendingDraw,
  addShape,
}: {
  pendingDraw: PendingDraw | null | undefined;
  addShape: (kind: ShapeKind) => void;
}) {
  const pendingShapeKind = pendingDraw && pendingDraw.type === 'shape' ? pendingDraw.kind : null;
  return (
    <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
      <IconButton
        label="Add pie chart"
        caption="Pie"
        description="A pie chart. Edit its labels + values from the Data menu."
        onClick={() => addShape('pie-chart')}
        dragKind="pie-chart"
        filled
        active={pendingShapeKind === 'pie-chart'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.25" />
          <path d="M12 12 L12 3 A9 9 0 0 1 20.5 15 Z" fill="currentColor" />
        </svg>
      </IconButton>
      <IconButton
        label="Add bar chart"
        caption="Bar"
        description="A bar chart. Edit its labels + values from the Data menu."
        onClick={() => addShape('bar-chart')}
        dragKind="bar-chart"
        filled
        active={pendingShapeKind === 'bar-chart'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="4" y="12" width="4" height="8" rx="1" opacity="0.45" />
          <rect x="10" y="7" width="4" height="13" rx="1" />
          <rect x="16" y="10" width="4" height="10" rx="1" opacity="0.7" />
        </svg>
      </IconButton>
      <IconButton
        label="Add line chart"
        caption="Line"
        description="A multi-series line chart. Edit the data grid or import a CSV from the Data menu."
        onClick={() => addShape('line-chart')}
        dragKind="line-chart"
        filled
        active={pendingShapeKind === 'line-chart'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 18 L9 11 L14 14 L20 6" />
        </svg>
      </IconButton>
      <IconButton
        label="Add progress bar"
        caption="Progress"
        description="Horizontal progress bar. Set the percentage from its menu."
        onClick={() => addShape('progress-bar')}
        dragKind="progress-bar"
        filled
        active={pendingShapeKind === 'progress-bar'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect
            x="2"
            y="6.5"
            width="14"
            height="5"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect x="2" y="6.5" width="8" height="5" rx="2.5" fill="currentColor" />
        </svg>
      </IconButton>
      <IconButton
        label="Add progress ring"
        caption="Donut"
        description="Donut progress ring. Set the percentage from its menu."
        onClick={() => addShape('progress-ring')}
        dragKind="progress-ring"
        filled
        active={pendingShapeKind === 'progress-ring'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          aria-hidden
        >
          <circle cx="9" cy="9" r="6" strokeWidth="2.4" opacity="0.3" />
          <path d="M9 3 a6 6 0 0 1 5.2 9" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </IconButton>
      <IconButton
        label="Add rating"
        caption="Rating"
        description="A 1–5 star rating. Set the score + an animation from its menu."
        onClick={() => addShape('rating')}
        dragKind="rating"
        filled
        active={pendingShapeKind === 'rating'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z"
            fill="currentColor"
          />
        </svg>
      </IconButton>
    </div>
  );
}
