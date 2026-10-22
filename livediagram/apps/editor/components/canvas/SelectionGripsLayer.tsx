import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useInsertShift } from '@/hooks/canvas/useInsertShift';

// The grips layer (docs/specs/008-canvas/canvas-and-palette.md "Resize", "The handles are always on
// top"): one layer in the canvas's transformed world, drawn after every element, that holds every
// selection grip. An element's own grips are portalled here from inside its view, so they keep the
// view's React event path (a press on a handle still bubbles, in React, through the element) while
// the DOM puts them above every element, whatever stacking context the element or a later sibling
// forms (rotation, opacity, animation, filter, a layer's opacity).

// Above the elements and anything inside them that carries its own z-index (a lane's gutter, a
// face's settings button, both z-10), below the remote cursors (40).
export const SELECTION_GRIPS_Z_INDEX = 30;

// Where the portals land: HTML grips in `box`, SVG grips (an arrow's) in `arrows`.
export type SelectionGripHosts = { box: HTMLElement; arrows: SVGGElement };

export const SelectionGripsContext = createContext<SelectionGripHosts | null>(null);

export function SelectionGripsLayer({
  onHosts,
  isoDepth,
  children,
}: {
  // Receives the hosts once mounted (in a layout effect, so the portals fill before the first
  // paint) and null on unmount.
  onHosts: (hosts: SelectionGripHosts | null) => void;
  // One past the top element's paint index, so isometric view lifts the layer above every
  // element's stagger (globals.css [data-iso] [data-selection-grips]).
  isoDepth?: number;
  // Grips the canvas draws itself (union handles, quick-connect pluses), under the portalled ones.
  children?: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const arrowsRef = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    onHosts({ box: boxRef.current!, arrows: arrowsRef.current! });
    return () => onHosts(null);
  }, [onHosts]);
  return (
    <div
      data-selection-grips=""
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: SELECTION_GRIPS_Z_INDEX, '--iso-z': isoDepth } as CSSProperties}
    >
      {children}
      {/* An arrow's grips are SVG in canvas coordinates, as in the arrow's own <svg>. */}
      <svg className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        <g ref={arrowsRef} />
      </svg>
      {/* After the arrow grips: a free arrow's frame handles sit over its end grips. */}
      <div ref={boxRef} />
    </div>
  );
}

// HTML grips, in canvas coordinates, moved into the layer. Nothing renders outside a layer.
export function BoxGripsPortal({ children }: { children: ReactNode }) {
  const hosts = useContext(SelectionGripsContext);
  return hosts ? createPortal(children, hosts.box) : null;
}

// SVG grips, in canvas coordinates, moved into the layer's <svg>. An arrow standing aside for the
// insert-between preview shifts its <svg>, so its grips take the same shift here.
export function ArrowGripsPortal({ arrowId, children }: { arrowId: string; children: ReactNode }) {
  const hosts = useContext(SelectionGripsContext);
  const shiftX = useInsertShift().xFor(arrowId);
  if (!hosts) return null;
  return createPortal(
    <g transform={shiftX ? `translate(${shiftX} 0)` : undefined}>{children}</g>,
    hosts.arrows,
  );
}
