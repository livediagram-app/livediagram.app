import {
  DEFAULT_SPOTLIGHT_CONFIG,
  spotlightExtent,
  spotlightFeather,
  spotlightShroud,
  type SpotlightConfig,
} from '@/lib/spotlight-config';

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

// The shroud's darkness, the rim's softness, and the light's shape all come
// from the Spotlight Panel (spec/112) now; the defaults below are exactly what
// they were before it existed — slate-950 at 82%, a 60px feathered rim, a
// circle — so someone who never opens the panel sees no change.

export function SpotlightOverlay({
  pos,
  radius,
  config = DEFAULT_SPOTLIGHT_CONFIG,
}: {
  pos: { x: number; y: number } | null;
  radius: number;
  config?: SpotlightConfig;
}) {
  const SHROUD = spotlightShroud(config);
  const FEATHER = spotlightFeather(config);
  // A circle is the radius both ways; "wide" spreads sideways to light a lane
  // or a table row without dragging the rows around it into the dark.
  const { rx, ry } = spotlightExtent(config, radius);
  // Before the first pointer-move we don't know where the cursor is, so park
  // the light in the middle of the canvas (a percentage avoids a measure
  // pass); once `pos` lands every update is a px offset that tracks live.
  const centred = pos === null;
  const at = centred ? '50% 50%' : `${pos.x}px ${pos.y}px`;
  const dotLeft = centred ? '50%' : `${pos.x}px`;
  const dotTop = centred ? '50%' : `${pos.y}px`;
  // Clear core ends where the feather begins; clamp so a small light still
  // has a usable centre. With an ellipse the ramp is expressed as a
  // percentage of each axis, so the feather stays even all the way round.
  const core = Math.max(0, radius - FEATHER);
  const corePct = radius === 0 ? 0 : Math.round((core / radius) * 100);

  return (
    <div
      aria-hidden
      // No explicit z-index: as a later DOM sibling than the (z-auto) element
      // wrapper it paints ABOVE the diagram, while the floating chrome
      // (palette / Explorer at z-[var(--z-panel)]/z-[var(--z-toolbar)], popovers at z-[var(--z-overlay)]) stays on top — so
      // the shroud dims the diagram but not the UI, and the presenter can
      // still reach the tool picker to switch back.
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(${rx}px ${ry}px at ${at}, transparent ${corePct}%, ${SHROUD} 100%)`,
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
