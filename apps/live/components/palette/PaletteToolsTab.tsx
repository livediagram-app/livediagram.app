import type { ShapeKind } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { IconButton } from '@/components/palette/palette-controls';

// A sub-category heading inside a tab. Lets one category hold a few labelled
// sections (e.g. Tools + Data) without spending a whole top-level tab on each
// — a lightweight divider, NOT an accordion (everything stays visible). The
// first heading drops its top padding so the section sits flush with the panel.
function PaletteSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 first:pt-0.5 dark:text-slate-500">
      {children}
    </div>
  );
}

// Data charts (spec/53): pie / bar / line / progress / rating. These now live
// as the **Data** sub-section of the Tools tab rather than their own top-level
// category, so the palette spends fewer tabs (see PaletteToolsTab). Each tile
// arms the tap-or-drag draw gesture via addShape, like the other ShapeKind
// tiles. Rendered as just the tile grid so it nests cleanly under a section
// heading.

export function PaletteToolsTab({
  pendingDraw,
  addShape,
  addArrow,
  addAvatar,
  addImage,
  addSticky,
  addTable,
  addText,
  addAnnotation,
  addLinkCard,
  beginFreehand,
  onAddImage,
}: {
  pendingDraw: PendingDraw | null | undefined;
  addShape: (kind: ShapeKind) => void;
  addArrow: () => void;
  addAvatar: () => void;
  addImage: () => void;
  addSticky: () => void;
  addTable: () => void;
  addText: () => void;
  addAnnotation: () => void;
  addLinkCard: () => void;
  beginFreehand: () => void;
  onAddImage?: () => void;
}) {
  const pendingShapeKind = pendingDraw && pendingDraw.type === 'shape' ? pendingDraw.kind : null;
  return (
    // Two labelled sub-sections in one tab: the drawing/element Tools, then the
    // Data charts (folded in from the old standalone Data category so the
    // palette spends one fewer top-level tab). Each section is a 3-column grid
    // of fixed tiles; a single-row flex used to overflow the palette width and
    // silently clip the last buttons off the right edge.
    <div className="flex flex-col">
      <PaletteSectionLabel>Tools</PaletteSectionLabel>
      <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
        <IconButton
          label="Add text"
          description="Text element. Double-click to edit."
          onClick={addText}
          active={pendingDraw?.type === 'text'}
          shortcut="T"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              d="M3 5h12M9 5v9M6.5 14h5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </IconButton>
        <IconButton
          label="Pencil (freehand)"
          description="Sketch a freehand stroke. Drag to draw; release near the start to close the shape."
          onClick={beginFreehand}
          active={pendingDraw?.type === 'freehand'}
          shortcut="P"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {/* Diagonal pencil. Body angled bottom-left to
                  top-right, with a separated tip + eraser segment
                  so the silhouette reads as "pencil" even at the
                  18 px palette size. Pairs with the cursor glyph
                  (also a diagonal nib) so the tool's two visual
                  surfaces stay in sync. */}
            <path d="M2 16 L6 12" />
            <path d="M5 13 L12 6 L14 8 L7 15 Z" />
            <path d="M12 6 L15 3 L17 5 L14 8" />
            <path d="M2 16 L5 13" />
          </svg>
        </IconButton>
        <IconButton
          label="Add arrow"
          description="Plain connector. Add pointers in the Pointer accordion."
          onClick={addArrow}
          active={pendingDraw?.type === 'arrow'}
          shortcut="A"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <line
              x1="3"
              y1="9"
              x2="15"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </IconButton>
        <IconButton
          label="Add sticky note"
          caption="Note"
          description="Sticky note for short annotations."
          onClick={addSticky}
          noTint
          active={pendingDraw?.type === 'sticky'}
          shortcut="N"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              d="M3 3h9l3 3v9H3z"
              fill="rgb(254 243 199)"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M12 3v3h3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <IconButton
          label="Add table"
          description="Editable grid. Double-click a cell to type."
          onClick={addTable}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <rect x="2.5" y="3.5" width="13" height="11" rx="1" />
            <line x1="2.5" y1="7.5" x2="15.5" y2="7.5" />
            <line x1="2.5" y1="11" x2="15.5" y2="11" />
            <line x1="7" y1="3.5" x2="7" y2="14.5" />
            <line x1="11" y1="3.5" x2="11" y2="14.5" />
          </svg>
        </IconButton>
        {onAddImage ? (
          <IconButton
            label="Add image"
            description="Drop an image placeholder + pick / upload a file."
            onClick={addImage}
            noTint
            active={pendingDraw?.type === 'image'}
            shortcut="9"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <rect
                x="2.5"
                y="3"
                width="13"
                height="12"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="7" cy="7" r="1.25" fill="currentColor" />
              <path
                d="M2.5 12 L6.5 8.5 L10 11 L13 8 L15.5 10.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        ) : null}
        {onAddImage ? (
          <IconButton
            label="Add avatar"
            description="Avatar. A circular image. Tap to drop or drag to size; double-click it to pick / upload a photo."
            onClick={addAvatar}
            active={pendingDraw?.type === 'component' && pendingDraw.kind === 'avatar'}
            noTint
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="9.5" r="3" />
              <path d="M6.5 19a6 6 0 0 1 11 0" />
            </svg>
          </IconButton>
        ) : null}
        <IconButton
          label="Add user"
          description="User / actor. Use-case and architecture diagrams."
          onClick={() => addShape('actor')}
          dragKind="actor"
          active={pendingShapeKind === 'actor'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="9" cy="4" r="2.4" />
            <path d="M9 6.4 L9 11.5" />
            <path d="M4.8 8.4 L13.2 8.4" />
            <path d="M9 11.5 L6 15.5" />
            <path d="M9 11.5 L12 15.5" />
          </svg>
        </IconButton>
        <IconButton
          label="Add frame"
          description="Frame. A titled container you draw around a cluster of elements."
          onClick={() => addShape('frame')}
          dragKind="frame"
          active={pendingShapeKind === 'frame'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2.5" y="4" width="13" height="10.5" />
            <path d="M2.5 6.8 H8.5" />
          </svg>
        </IconButton>
        <IconButton
          label="Add annotation"
          description="Annotation. A note marker: hover to read it, click to edit."
          onClick={addAnnotation}
          filled
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
            <path d="M6.5 9.75h11" />
            <path d="M6.5 12.5h7" />
          </svg>
        </IconButton>
        <IconButton
          label="Add link card"
          description="Link card. A bookmark preview with the page's title, favicon, and image."
          onClick={addLinkCard}
          noTint
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
            <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
          </svg>
        </IconButton>
        <IconButton
          label="Add timeline rail"
          caption="Timeline"
          description="A line with points above it. Add more points from its right-end button."
          onClick={() => addShape('timeline-rail')}
          dragKind="timeline-rail"
          filled
          active={pendingShapeKind === 'timeline-rail'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <line
              x1="2"
              y1="12"
              x2="16"
              y2="12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="4.5" cy="6" r="1.8" fill="currentColor" />
            <circle cx="9" cy="6" r="1.8" fill="currentColor" />
            <circle cx="13.5" cy="6" r="1.8" fill="currentColor" />
          </svg>
        </IconButton>
      </div>
      <PaletteSectionLabel>Data</PaletteSectionLabel>
      <PaletteDataTab pendingDraw={pendingDraw} addShape={addShape} />
    </div>
  );
}

// Data-element tiles (charts / rating / timeline rail). Rendered inside the
// Tools tab's Data section; co-located here since PaletteToolsTab is its only
// caller.
function PaletteDataTab({
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
