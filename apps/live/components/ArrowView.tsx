import type { PointerEvent as ReactPointerEvent } from 'react';
import {
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

  const stroke = isSelected ? 'rgb(2 132 199)' /* brand-600 */ : 'rgb(51 65 85)' /* slate-700 */;
  const strokeWidth = isSelected ? 2.5 : 2;
  const markerId = isSelected ? 'arrowhead-selected' : 'arrowhead-default';
  const hitCursor = isPaintMode ? 'copy' : 'pointer';

  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
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
  const fill = pinned ? 'rgb(2 132 199)' : 'white';
  const stroke = 'rgb(2 132 199)';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={fill}
      stroke={stroke}
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
  return (
    <defs>
      <marker
        id="arrowhead-default"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(51 65 85)" />
      </marker>
      <marker
        id="arrowhead-selected"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(2 132 199)" />
      </marker>
    </defs>
  );
}
