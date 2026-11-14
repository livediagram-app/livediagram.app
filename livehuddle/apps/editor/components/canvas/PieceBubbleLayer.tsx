'use client';

// Where the proximity bubbles draw (docs/specs/009-elements/social-pieces.md "Arcade Machine", Work Tracker 793): over
// the characters, not under them. A piece's face lives in the element layer, which the characters stand in front of,
// so a bubble drawn there had the legs of whoever stood at the piece across its text. The characters' layer holds one
// host, raised over every figure and its chip (z-[2]; speech bubbles stand higher still), and a face's bubble is
// portalled into it at the piece's box. With no host mounted (a test, a preview) the bubble draws in place.

import { useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

let host: HTMLElement | null = null;
const listeners = createListeners();

function setHost(next: HTMLElement | null): void {
  if (host === next) return;
  host = next;
  listeners.notify();
}

/** The host the bubbles draw into: once, in the characters' layer, after every character. */
export function PieceBubbleHost() {
  const mine = useRef<HTMLDivElement | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (el) setHost(el);
    // Leaving: only its own host goes (another canvas may have mounted one since).
    else if (host === mine.current) setHost(null);
    mine.current = el;
  }, []);
  return (
    <div
      ref={ref}
      data-piece-bubbles=""
      className="pointer-events-none absolute left-0 top-0 z-[2]"
    />
  );
}

/** A piece's bubble, drawn over the characters at the piece's box (canvas px); in place with no host. */
export function PieceBubblePortal({
  box,
  children,
}: {
  box: { x: number; y: number; width: number; height: number };
  children: ReactNode;
}) {
  const target = useSyncExternalStore(
    listeners.subscribe,
    () => host,
    () => null,
  );
  if (!target) return <div className="pointer-events-none absolute inset-0">{children}</div>;
  return createPortal(
    <div
      className="pointer-events-none absolute"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      {children}
    </div>,
    target,
  );
}
