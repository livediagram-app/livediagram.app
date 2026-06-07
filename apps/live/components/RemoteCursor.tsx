// Floating cursor for a remote participant (extracted from Canvas so
// CanvasElementsLayer can render it inside the transformed wrapper).
// Position is in canvas coords (so the cursor pans + zooms with the
// canvas), but the SVG + name pill are counter-scaled so they keep their
// on-screen size at any zoom — same trick the badges + plus buttons use.
export function RemoteCursor({
  cursor,
  zoom,
}: {
  cursor: { id: string; name: string; color: string; x: number; y: number };
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
        className="absolute left-3 top-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </span>
    </div>
  );
}
