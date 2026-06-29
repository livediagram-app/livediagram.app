import type { ShapeKind } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { IconButton } from '@/components/palette/palette-controls';

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
