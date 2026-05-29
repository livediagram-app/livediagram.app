import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  defaultArrowStrokeColor,
  endpointPosition,
  type ArrowElement,
  type Element,
} from '@livediagram/diagram';
import type { ArrowEnd } from '@/lib/canvas';

type ArrowViewProps = {
  arrow: ArrowElement;
  elements: Element[];
  isSelected: boolean;
  isPaintMode: boolean;
  onSelect: (e: ReactPointerEvent) => void;
  onBeginEndpointDrag: (end: ArrowEnd, e: ReactPointerEvent) => void;
};

const BRAND_600 = 'rgb(2 132 199)';

export function ArrowView({
  arrow,
  elements,
  isSelected,
  isPaintMode,
  onSelect,
  onBeginEndpointDrag,
}: ArrowViewProps) {
  const isLocked = arrow.locked === true;
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);

  // Per-arrow stroke colour overrides the default; selection ring sits
  // on top in brand-600 regardless so the user can still tell what's
  // selected on a coloured arrow.
  const baseStroke = arrow.strokeColor ?? defaultArrowStrokeColor();
  const strokeWidth = isSelected ? 2.5 : 2;
  const hitCursor = isPaintMode ? 'copy' : 'pointer';
  const opacity = arrow.opacity ?? 1;

  // SVG `<marker>` defs don't inherit stroke from the referencing path,
  // but they DO inherit `color`. Setting the group's `color` to the
  // arrow's stroke + drawing the marker arrowhead with `fill=currentColor`
  // means a single shared marker def picks up any colour we throw at it.
  return (
    <g style={{ color: baseStroke, opacity }}>
      {isSelected ? (
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={BRAND_600}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeOpacity={0.35}
          style={{ pointerEvents: 'none' }}
        />
      ) : null}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd="url(#arrowhead)"
        style={{ pointerEvents: 'none' }}
      />

      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="transparent"
        strokeWidth={14}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(e);
        }}
        style={{ pointerEvents: 'stroke', cursor: hitCursor }}
      />

      {isSelected && !isPaintMode ? (
        <>
          <EndpointHandle
            cx={from.x}
            cy={from.y}
            pinned={arrow.from.kind === 'pinned'}
            disabled={isLocked}
            onPointerDown={(e) => {
              if (isLocked) return;
              e.stopPropagation();
              onBeginEndpointDrag('from', e);
            }}
          />
          <EndpointHandle
            cx={to.x}
            cy={to.y}
            pinned={arrow.to.kind === 'pinned'}
            disabled={isLocked}
            onPointerDown={(e) => {
              if (isLocked) return;
              e.stopPropagation();
              onBeginEndpointDrag('to', e);
            }}
          />
        </>
      ) : null}
    </g>
  );
}

type EndpointHandleProps = {
  cx: number;
  cy: number;
  pinned: boolean;
  disabled: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
};

function EndpointHandle({ cx, cy, pinned, disabled, onPointerDown }: EndpointHandleProps) {
  const fill = pinned ? BRAND_600 : 'white';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={fill}
      stroke={BRAND_600}
      strokeWidth={2}
      onPointerDown={onPointerDown}
      style={{
        pointerEvents: 'all',
        cursor: disabled ? 'default' : 'grab',
      }}
    />
  );
}

export function ArrowDefs() {
  // Single shared arrowhead marker. `fill="context-stroke"` would be
  // ideal but isn't supported everywhere; `currentColor` works because
  // ArrowView sets `color` on the group containing the line.
  return (
    <defs>
      <marker
        id="arrowhead"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
      </marker>
    </defs>
  );
}
