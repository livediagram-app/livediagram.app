// The eraser's brush, drawn where the cursor is (spec/113).
//
// An eraser you can't see the size of is a worse tool than a precise one: at
// Large the brush reaches 72px, which is most of a sticky note, and the only
// way to know what a sweep will take is to see it first. So the ring follows
// the pointer at the brush's true radius, above the diagram and below the
// chrome, and never takes a pointer event itself.
//
// It turns AMBER whenever a target filter is on, matching the panel's preview,
// so a restricted eraser never looks like a broken one.

export function EraserBrushRing({
  pos,
  radius,
  filtered,
}: {
  // Pointer position in px relative to <main>, or null before the first move
  // over the canvas (nothing to draw yet — unlike the spotlight, an eraser
  // parked in the middle of the screen would be a lie).
  pos: { x: number; y: number } | null;
  radius: number;
  filtered: boolean;
}) {
  // A Point brush has no size to show; the OS cursor already marks the spot.
  if (!pos || radius <= 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-full border-2"
      style={{
        left: pos.x,
        top: pos.y,
        width: radius * 2,
        height: radius * 2,
        transform: 'translate(-50%, -50%)',
        borderColor: filtered ? 'rgba(245, 158, 11, 0.9)' : 'rgba(100, 116, 139, 0.85)',
        background: filtered ? 'rgba(245, 158, 11, 0.12)' : 'rgba(148, 163, 184, 0.14)',
      }}
    />
  );
}
