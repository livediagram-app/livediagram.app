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

  // The shared marker def uses `fill="context-stroke"` which resolves to
  // the *concrete* stroke paint of the referencing element. Setting
  // `stroke={baseStroke}` directly on the line (rather than via
  // currentColor) means context-stroke gets the real colour rather
  // than a chained `currentColor` keyword that ends up resolving on
  // the marker's own colour property.
  return (
    <g style={{ opacity }}>
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
        stroke={baseStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerStart={
          arrow.arrowEnds === 'from' || arrow.arrowEnds === 'both' ? 'url(#arrowhead)' : undefined
        }
        markerEnd={
          arrow.arrowEnds === 'to' || arrow.arrowEnds === 'both' || arrow.arrowEnds === undefined
            ? 'url(#arrowhead)'
            : undefined
        }
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
  // Single shared arrowhead marker. `fill="context-stroke"` is the
  // canonical SVG2 way to make a marker pick up the referencing line's
  // stroke colour; modern Chrome / Firefox / Safari all support it.
  // currentColor didn't reliably inherit through the marker boundary in
  // every browser, leaving arrowheads stuck on the default slate.
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
        <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
      </marker>
    </defs>
  );
}
