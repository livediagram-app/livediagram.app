import type { ShapeKind } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { IconButton } from './palette-controls';

// Palette tab CONTENTS extracted from CommandPalette.tsx to keep that file under
// the ~1000-line budget. Each is the tile grid for one creation tab; the tiles
// call the editor's add* handlers (passed in) and highlight the pending
// draw-to-size intent. The search-driven tabs (Icons / Technology / Devices)
// stay inline in CommandPalette since they own the search/filter state.

export function PaletteShapesTab({
  pendingDraw,
  addShape,
}: {
  pendingDraw: PendingDraw | null | undefined;
  addShape: (kind: ShapeKind) => void;
}) {
  const pendingShapeKind = pendingDraw && pendingDraw.type === 'shape' ? pendingDraw.kind : null;
  return (
    // Six-column grid (matching the Icons catalogue) so the fixed
    // 36px tiles pack into even, full rows. flex-wrap left a few px
    // short of a sixth tile, so the last shape dropped to its own
    // row with dead space on the right; the grid divides the width
    // into six equal cells and centres each tile. overflow-x-hidden
    // absorbs the few-px slack when six fixed tiles slightly exceed
    // the cell width, exactly as the Icons grid does.
    <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
      <IconButton
        label="Add square"
        description="Drop a new square shape on the canvas."
        onClick={() => addShape('square')}
        dragKind="square"
        filled
        active={pendingShapeKind === 'square'}
        shortcut="R"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect
            x="3"
            y="3"
            width="12"
            height="12"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add circle"
        description="Drop a new circle shape on the canvas."
        onClick={() => addShape('circle')}
        dragKind="circle"
        filled
        active={pendingShapeKind === 'circle'}
        shortcut="O"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </IconButton>
      <IconButton
        label="Add diamond"
        description="Diamond. Decision node."
        onClick={() => addShape('diamond')}
        dragKind="diamond"
        filled
        active={pendingShapeKind === 'diamond'}
        shortcut="D"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <polygon
            points="9,2.5 15.5,9 9,15.5 2.5,9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add cylinder"
        description="Cylinder. Flowchart database / storage."
        onClick={() => addShape('cylinder')}
        dragKind="cylinder"
        filled
        active={pendingShapeKind === 'cylinder'}
        shortcut="C"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            d="M3 5 L3 13 A6 1.8 0 0 0 15 13 L15 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <ellipse
            cx="9"
            cy="5"
            rx="6"
            ry="1.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add parallelogram"
        description="Parallelogram. Flowchart input / output."
        onClick={() => addShape('parallelogram')}
        dragKind="parallelogram"
        filled
        active={pendingShapeKind === 'parallelogram'}
        shortcut="G"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <polygon
            points="5,3 16,3 13,15 2,15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add hexagon"
        description="Hexagon. Preparation / milestone."
        onClick={() => addShape('hexagon')}
        dragKind="hexagon"
        filled
        active={pendingShapeKind === 'hexagon'}
        shortcut="H"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <polygon
            points="5,3 13,3 16,9 13,15 5,15 2,9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add document"
        description="Document shape. Flowchart output."
        onClick={() => addShape('document')}
        dragKind="document"
        filled
        active={pendingShapeKind === 'document'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            d="M3 3 L15 3 L15 13 C13 15.3 11 11.8 9 13.5 C7 15.3 5 11.8 3 13.5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add stadium"
        description="Stadium shape. Flowchart Start / End."
        onClick={() => addShape('stadium')}
        dragKind="stadium"
        filled
        active={pendingShapeKind === 'stadium'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect
            x="1.5"
            y="6"
            width="15"
            height="6"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add cloud"
        description="Cloud. Networking / architecture."
        onClick={() => addShape('cloud')}
        dragKind="cloud"
        filled
        active={pendingShapeKind === 'cloud'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5.5 13.5 C3.2 13.5 2 11.7 3.4 10.2 C2.4 8.7 4 7 5.5 7.7 C6 5.4 9.4 5.2 9.9 7.6 C11.9 6.7 13.5 8.6 12.2 10.2 C13.5 11.2 12.6 13.5 10.8 13.5 Z" />
        </svg>
      </IconButton>
      <IconButton
        label="Add triangle"
        description="Triangle. A basic shape."
        onClick={() => addShape('triangle')}
        dragKind="triangle"
        filled
        active={pendingShapeKind === 'triangle'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <polygon
            points="9,3 16,15 2,15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add trapezoid"
        description="Trapezoid. Flowchart manual operation."
        onClick={() => addShape('trapezoid')}
        dragKind="trapezoid"
        filled
        active={pendingShapeKind === 'trapezoid'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <polygon
            points="5,4 13,4 16,15 2,15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add star"
        description="Star. Highlight or rating."
        onClick={() => addShape('star')}
        dragKind="star"
        filled
        active={pendingShapeKind === 'star'}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <polygon
            points="9,1.5 10.8,6.6 16.1,6.7 11.9,9.9 13.4,15.1 9,12 4.6,15.1 6.1,9.9 1.9,6.7 7.2,6.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton
        label="Add speech bubble"
        caption="Bubble"
        description="Speech bubble. A callout with a tail."
        onClick={() => addShape('speech-bubble')}
        dragKind="speech-bubble"
        filled
        active={pendingShapeKind === 'speech-bubble'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 3 H14 a2 2 0 0 1 2 2 V10 a2 2 0 0 1 -2 2 H7 L4.5 15.5 L5.5 12 H4 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z" />
        </svg>
      </IconButton>
    </div>
  );
}

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
    // Six-column grid (matching the Shapes + Icons tabs) so the
    // fixed tiles wrap into even rows. A single-row flex used to
    // overflow the palette width and silently clip the last
    // buttons (user / frame / annotation) off the right edge.
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
          shortcut="I"
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
    </div>
  );
}

export function PaletteComponentsTab({
  pendingDraw,
  addBanner,
  addHero,
  addHeader,
  addCallout,
  addStatRow,
  addProcess,
  onAddImage,
}: {
  pendingDraw: PendingDraw | null | undefined;
  addBanner: () => void;
  addHero: () => void;
  addHeader: () => void;
  addCallout: () => void;
  addStatRow: () => void;
  addProcess: () => void;
  onAddImage?: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      <IconButton
        label="Add banner"
        description="Banner. A themed title block (accent bar with a title and subtitle) to head your diagram. Tap to drop or drag to size; drops as a group you can recolour, retitle, or ungroup."
        onClick={addBanner}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'banner'}
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
          <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
          <path d="M7 10.75h10" strokeWidth="2.2" />
          <path d="M9 14.25h6" />
        </svg>
      </IconButton>
      <IconButton
        label="Add callout"
        description="Callout. A soft note box with an icon, title, and body for annotating a diagram. Tap to drop or drag to size."
        onClick={addCallout}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'callout'}
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
          <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
          <circle cx="7" cy="9" r="2" fill="currentColor" stroke="none" />
          <path d="M11 8.5h8M6 13h13M6 16h9" />
        </svg>
      </IconButton>
      <IconButton
        label="Add stat row"
        description="Stat row. Three KPI cards (big number + caption) for dashboards / summaries. Tap to drop or drag to size."
        onClick={addStatRow}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'stat'}
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
          <rect x="2" y="6" width="6" height="12" rx="1" />
          <rect x="9" y="6" width="6" height="12" rx="1" />
          <rect x="16" y="6" width="6" height="12" rx="1" />
          <path d="M3.5 10.5h3M10.5 10.5h3M17.5 10.5h3" />
        </svg>
      </IconButton>
      <IconButton
        label="Add process steps"
        description="Process steps. Numbered circles joined by arrows with captions, for flows. Tap to drop or drag to size."
        onClick={addProcess}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'process'}
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
          <circle cx="5" cy="12" r="3" />
          <circle cx="12" cy="12" r="3" />
          <circle cx="19" cy="12" r="3" />
          <path d="M8 12h1M15 12h1" />
        </svg>
      </IconButton>
      {onAddImage ? (
        <IconButton
          label="Add hero"
          description="Hero. A large image with a title and supporting line on a themed caption card. Tap to drop or drag to size; double-click the image to set it."
          onClick={addHero}
          active={pendingDraw?.type === 'component' && pendingDraw.kind === 'hero'}
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
            <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
            <path d="M2.5 14l5-4 4 3 3-2.5 7 5.5" />
            <path d="M7 17.5h10" strokeWidth="2.2" />
          </svg>
        </IconButton>
      ) : null}
      {onAddImage ? (
        <IconButton
          label="Add header"
          description="Header. A website-style bar with a circular avatar, brand title, and nav links. Tap to drop or drag to size; double-click the avatar to set it."
          onClick={addHeader}
          active={pendingDraw?.type === 'component' && pendingDraw.kind === 'header'}
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
            <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
            <circle cx="7" cy="12" r="2.2" />
            <path d="M14 10.5h5M14 13.5h5" />
          </svg>
        </IconButton>
      ) : null}
    </div>
  );
}
