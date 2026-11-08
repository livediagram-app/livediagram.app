import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The grips layer (docs/specs/008-canvas/canvas-and-palette.md "Resize", "The handles are always on
// top"): one layer in the canvas's transformed world, drawn after every element, that holds every
// selection grip. An element's own grips are portalled here from inside its view, so they keep the
// view's React event path (a press on a handle still bubbles, in React, through the element) while
// the DOM puts them above every element, whatever stacking context the element or a later sibling
// forms (rotation, opacity, animation, filter, a layer's opacity).

// Above the elements and anything inside them that carries its own z-index (a lane's gutter, a
// face's settings button, both z-10), below the remote cursors (40).
export const SELECTION_GRIPS_Z_INDEX = 30;

// Where the portals land: the grips are HTML, in `box`.
export type SelectionGripHosts = { box: HTMLElement };

export const SelectionGripsContext = createContext<SelectionGripHosts | null>(null);

export function SelectionGripsLayer({
  onHosts,
  children,
}: {
  // Receives the hosts once mounted (in a layout effect, so the portals fill before the first
  // paint) and null on unmount.
  onHosts: (hosts: SelectionGripHosts | null) => void;
  // Grips the canvas draws itself (union handles), under the portalled ones.
  children?: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    onHosts({ box: boxRef.current! });
    return () => onHosts(null);
  }, [onHosts]);
  return (
    <div
      data-selection-grips=""
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: SELECTION_GRIPS_Z_INDEX }}
    >
      {children}
      {/* Where the layer is, so it can carry a very large move's offset for the grips in it. */}
      <div ref={boxRef} data-ride-plane="" className="absolute inset-0" />
    </div>
  );
}

// HTML grips, in canvas coordinates, moved into the layer. Nothing renders outside a layer.
export function BoxGripsPortal({ children }: { children: ReactNode }) {
  const hosts = useContext(SelectionGripsContext);
  return hosts ? createPortal(children, hosts.box) : null;
}
