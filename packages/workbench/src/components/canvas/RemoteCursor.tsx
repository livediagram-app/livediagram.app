'use client';

import { memo, useRef, type CSSProperties } from 'react';
import { PictureDisc } from '@liveworkspace/ui';
import { IDENTITY_FILL } from '@liveworkspace/ui/identity-fill';
import { initialsOf } from '@liveworkspace/model-core/names';
import { useCursorsNearPointer } from '../../hooks/canvas/useCursorsNearPointer';
import { useCanvasZoom } from './CanvasZoomContext';

// Another participant's cursor on the canvas: the arrow in their colour and the pill with their name (and their
// picture, liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures", only when there is one).

/** One remote cursor as the canvas draws it: canvas coordinates, joined with the person's name and colour. */
export type RemoteCursorRow = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  picture?: string;
};

/** The product's identity fill (its identity-fill.ts `identityVars`): both shades of a colour as CSS variables. */
export type PaintIdentity = (color: string) => CSSProperties;

const CURSOR_PICTURE_PX = 14;

// Position is in canvas coords (so the cursor pans + zooms with the canvas), but the SVG + name pill are
// counter-scaled so they keep their on-screen size at any zoom, the same trick the badges and plus buttons use.
// It never takes a pointer: `pointer-events-none` lets every click through to what is beneath, faded or not.
// Memoised: one cursor stepping aside re-renders that cursor, not the whole room.
export const RemoteCursor = memo(function RemoteCursor({
  cursor,
  zoom,
  paint,
  faded = false,
}: {
  cursor: RemoteCursorRow;
  zoom: number;
  paint: PaintIdentity;
  // Stepping aside for this screen's pointer (docs/specs/012-collaboration/collaborator-enhancements.md
  // "Cursors Step Aside").
  faded?: boolean;
}) {
  return (
    <div
      aria-hidden
      data-remote-cursor={cursor.id}
      data-faded={faded || undefined}
      className={`pointer-events-none absolute motion-safe:transition-opacity motion-safe:duration-micro ${faded ? 'opacity-0' : ''}`}
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'top left',
        zIndex: 40,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill={cursor.color}
        stroke="white"
        strokeWidth="1"
      >
        <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
      </svg>
      <span
        className={`absolute left-3 top-3 flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm ${IDENTITY_FILL}`}
        style={paint(cursor.color)}
      >
        {cursor.picture ? (
          <PictureDisc
            pictureUrl={cursor.picture}
            name=""
            size={CURSOR_PICTURE_PX}
            aria-hidden
            className="-ml-0.5 text-[7px]"
          >
            {initialsOf(cursor.name)}
          </PictureDisc>
        ) : null}
        {cursor.name}
      </span>
    </div>
  );
});

// Every remote cursor on the active tab, drawn inside the canvas's panned + zoomed wrapper. It reads the zoom
// itself (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"), so the layer around it takes
// no view. A cursor under or near this screen's own pointer fades out of the way until the pointer leaves
// (docs/specs/012-collaboration/collaborator-enhancements.md "Cursors Step Aside"); the anchor, a point at canvas
// (0, 0), is where the hit test reads the canvas's place on screen.
export function RemoteCursors({
  cursors,
  paint,
}: {
  cursors: readonly RemoteCursorRow[];
  paint: PaintIdentity;
}) {
  const zoom = useCanvasZoom();
  const anchor = useRef<HTMLDivElement>(null);
  const near = useCursorsNearPointer(cursors, zoom, anchor);
  if (cursors.length === 0) return null;
  return (
    <>
      <div ref={anchor} aria-hidden className="pointer-events-none absolute left-0 top-0 size-0" />
      {cursors.map((c) => (
        <RemoteCursor key={c.id} cursor={c} zoom={zoom} paint={paint} faded={near.has(c.id)} />
      ))}
    </>
  );
}
