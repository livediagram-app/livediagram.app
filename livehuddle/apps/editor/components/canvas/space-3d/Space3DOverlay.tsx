'use client';

// The 3D view's overlay (docs/specs/008-canvas/3d-view.md "What it shows"; blueprint: 3d-view.md "The overlay"): what
// floats over a head (speech, the Receptionist's card, call bubbles, talking bars, raised hands) is drawn in a scene of
// its own, a second stage with the same camera laid over the first, so a wall can never hide it however near it
// stands. Inside, each one still stands about its speaker's feet under the same tilt and viewport transform, so it
// lands exactly over the head it belongs to, moved by the same DOM writes as the world (no render per step). Flat,
// there is no overlay and everything draws where it always has. Each one is drawn into a host of its own that is
// moved between its place and the overlay, never unmounted, so a half-typed message, its caret and a bubble's float all
// carry across turning the view on or off.

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useFlatBillboards } from './useFlatBillboards';
import {
  useViewportTransform,
  viewportTransform,
} from '@liveworkspace/workbench/hooks/canvas/useViewportTransform';

type Overlay = { on: boolean; node: HTMLElement | null };

const Space3DOverlayContext = createContext<Overlay>({ on: false, node: null });

export const Space3DOverlayProvider = Space3DOverlayContext.Provider;

/** Whether the 3D view shows (in any phase but flat). */
export function useInSpace3D(): boolean {
  return useContext(Space3DOverlayContext).on;
}

/**
 * Draws its children in the 3D view's overlay while there is one, in place otherwise. They live in one host element
 * (no box of its own: `display: contents`) that moves between a slot here and the overlay, so they stay mounted.
 */
export function InSpace3DOverlay({ children }: { children: ReactNode }) {
  const { node } = useContext(Space3DOverlayContext);
  const [host] = useState(() => {
    const el = document.createElement('div');
    el.style.display = 'contents';
    el.setAttribute('data-space-overlay-host', '');
    return el;
  });
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = node ?? slot.current;
    if (target && host.parentNode !== target) moveKeepingFocus(host, target);
  }, [node, host]);
  useLayoutEffect(() => () => host.remove(), [host]);
  return (
    <>
      <div ref={slot} style={{ display: 'contents' }} />
      {createPortal(children, host)}
    </>
  );
}

// Moving a node blurs whatever inside it had focus: give the focus, and a text field's caret, back.
function moveKeepingFocus(host: HTMLElement, target: HTMLElement): void {
  const active = document.activeElement;
  const focused = active instanceof HTMLElement && host.contains(active) ? active : null;
  const field =
    focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused : null;
  const start = field?.selectionStart ?? null;
  const end = field?.selectionEnd ?? null;
  const direction = field?.selectionDirection ?? undefined;
  target.appendChild(host);
  if (!focused) return;
  focused.focus({ preventScroll: true });
  if (field && start !== null && end !== null) field.setSelectionRange(start, end, direction);
}

const noBackground: RefObject<HTMLElement | null> = { current: null };
const noPattern = () => undefined;

/**
 * The overlay's stage: the camera again, over the world's, and a world layer moved with the viewport as the canvas's
 * is. `onNode` receives the world layer, where the overlay's children are drawn.
 */
export function Space3DOverlayStage({
  style,
  zoom,
  onNode,
}: {
  style: React.CSSProperties | undefined;
  zoom: number;
  onNode: (node: HTMLElement | null) => void;
}) {
  const world = useRef<HTMLDivElement | null>(null);
  const view = useViewportTransform(world, noBackground, noPattern);
  useFlatBillboards(world, zoom);
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      world.current = node;
      onNode(node);
    },
    [onNode],
  );
  return (
    <div
      data-space-stage=""
      data-space-overlay=""
      className="pointer-events-none absolute inset-0"
      style={style}
    >
      <div
        ref={ref}
        data-space-overlay-world=""
        className="pointer-events-none absolute inset-0 origin-center"
        style={{
          transform: viewportTransform(view),
          scale: `1 1 ${zoom}`,
        }}
      />
    </div>
  );
}
