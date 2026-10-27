'use client';

import type { CSSProperties } from 'react';
import { PictureDisc } from '@liveworkspace/ui';
import { IDENTITY_FILL } from '@liveworkspace/ui/identity-fill';
import { initialsOf } from '@liveworkspace/model-core/names';
import { useHideCursors } from '../../hooks/collab/useHideCursors';
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
export function RemoteCursor({
  cursor,
  zoom,
  paint,
}: {
  cursor: RemoteCursorRow;
  zoom: number;
  paint: PaintIdentity;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
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
}

// Every remote cursor on the active tab, drawn inside the canvas's panned + zoomed wrapper. It reads the zoom
// itself (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the canvas"), so the layer around it takes
// no view, and it draws nothing while this screen hides participant cursors
// (docs/specs/012-collaboration/collaborator-enhancements.md "Hide Participant Cursors").
export function RemoteCursors({
  cursors,
  paint,
}: {
  cursors: readonly RemoteCursorRow[];
  paint: PaintIdentity;
}) {
  const zoom = useCanvasZoom();
  const { hidden } = useHideCursors();
  if (hidden) return null;
  return cursors.map((c) => <RemoteCursor key={c.id} cursor={c} zoom={zoom} paint={paint} />);
}
