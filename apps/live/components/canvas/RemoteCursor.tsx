import { PictureDisc, IDENTITY_FILL, identityVars } from '@livediagram/ui';
import { initialsOf } from '@/lib/identity';

// The pill's leading picture (docs/specs/014-identity/profile-picture.md §5), only when there is one.
const CURSOR_PICTURE_PX = 14;

// Floating cursor for a remote participant (extracted from Canvas so
// CanvasElementsLayer can render it inside the transformed wrapper).
// Position is in canvas coords (so the cursor pans + zooms with the
// canvas), but the SVG + name pill are counter-scaled so they keep their
// on-screen size at any zoom — same trick the badges + plus buttons use.
export function RemoteCursor({
  cursor,
  zoom,
}: {
  cursor: { id: string; name: string; color: string; x: number; y: number; picture?: string };
  zoom: number;
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
        style={identityVars(cursor.color)}
      >
        {cursor.picture ? (
          <PictureDisc
            pictureUrl={cursor.picture}
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
