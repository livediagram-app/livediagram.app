// Spotlight presenter overlay (spec/09). A full-bleed, pointer-transparent
// shroud over the canvas with a single soft circle of clarity around the
// cursor. The shroud + the hole are one radial-gradient: transparent at the
// centre, ramping to a dark fill at the light's radius and holding that fill
// across the rest of the canvas. The gradient centre tracks the cursor in
// screen space (so the light does NOT pan / zoom with the diagram), and the
// feathered rim gives the "emits light" falloff a hard-edged mask can't.
//
// The glowing dot at the centre is drawn here as a DOM element (the OS cursor
// is hidden via .cursor-spotlight): a data-URI SVG cursor renders
// inconsistently across browsers and silently falls back, whereas this locks
// to the light's exact centre and can actually glow.
//
// pointer-events-none so clicks fall through to <main>, where the Canvas
// capture handlers turn left-click into grow and right-click into shrink.

// Shroud colour (slate-950 at 82%) — dark enough to mute the diagram, not so
// opaque that a faint sense of the surrounding shapes is lost.
const SHROUD = 'rgba(2, 6, 23, 0.82)';
// Rim softness in px: the gradient ramps from clear to full shroud over this
// distance just inside the radius, so the light fades out rather than
// stopping at a crisp line.
const FEATHER = 60;

export function SpotlightOverlay({
  pos,
  radius,
}: {
  pos: { x: number; y: number } | null;
  radius: number;
}) {
  // Before the first pointer-move we don't know where the cursor is, so park
  // the light in the middle of the canvas (a percentage avoids a measure
  // pass); once `pos` lands every update is a px offset that tracks live.
  const centred = pos === null;
  const at = centred ? '50% 50%' : `${pos.x}px ${pos.y}px`;
  const dotLeft = centred ? '50%' : `${pos.x}px`;
  const dotTop = centred ? '50%' : `${pos.y}px`;
  // Clear core ends where the feather begins; clamp so a small light still
  // has a usable centre.
  const core = Math.max(0, radius - FEATHER);

  return (
    <div
      aria-hidden
      // No explicit z-index: as a later DOM sibling than the (z-auto) element
      // wrapper it paints ABOVE the diagram, while the floating chrome
      // (palette / Explorer at z-10/z-20, popovers at z-40) stays on top — so
      // the shroud dims the diagram but not the UI, and the presenter can
      // still reach the tool picker to switch back.
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(circle ${radius}px at ${at}, transparent ${core}px, ${SHROUD} ${radius}px)`,
      }}
    >
      {/* Glowing dot marking the exact centre of the light (the hidden OS
          cursor's stand-in). A bright sky core with a white rim reads on both
          light diagram content and the dark shroud; the box-shadow is the
          glow. */}
      <div
        className="absolute h-2.5 w-2.5 rounded-full"
        style={{
          left: dotLeft,
          top: dotTop,
          transform: 'translate(-50%, -50%)',
          background: '#38bdf8',
          border: '1.5px solid rgba(255, 255, 255, 0.95)',
          boxShadow: '0 0 10px 3px rgba(56, 189, 248, 0.85), 0 0 3px 1px rgba(255, 255, 255, 0.9)',
        }}
      />
    </div>
  );
}
