// The face of a Portal element (spec/104): a standing ring of energy, in the
// shape everyone already knows from the game — a tall oval you step into and
// come out of somewhere else.
//
// The art is one SVG on a fixed 24x36 grid with `preserveAspectRatio` kept, so
// a resized portal scales as an oval instead of squashing into a letterbox.
// Depth comes from three layered ellipses rather than a bitmap: an outer bloom
// (the light it throws), the bright rim itself, and a dark elliptical mouth you
// can see "through", with a couple of motes caught in the swirl. Every tone is
// derived from the element's own stroke colour, so recolouring a portal
// recolours the whole effect instead of stranding a hard-coded orange.
//
// A LINKED portal is lit: rim at full strength, mouth glowing, motes visible.
// An unlinked one is a dead ring — dim, no bloom, inert to clicks — and its
// tooltip says why. A portal that silently swallows a click is worse than one
// that admits it isn't wired up.
//
// Interaction rules match the Selection Mode button (spec/103): a real <button>
// so a click travels rather than only selecting, `pointer-events: auto` so it
// works inside the pointer-inert Avatar / Spotlight / Isometric layers, and
// pointer-down left alone so dragging still moves it.

import { useId } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

function PortalArt({ stroke, open }: { stroke: string; open: boolean }) {
  const id = useId().replace(/:/g, '');
  const bloomId = `portal-bloom-${id}`;
  const rimId = `portal-rim-${id}`;
  const mouthId = `portal-mouth-${id}`;
  return (
    <svg
      viewBox="0 0 24 36"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        {/* The light the ring throws around it: nothing in the middle (the
            mouth is dark), strongest just outside the rim, gone by the edge. */}
        <radialGradient id={bloomId}>
          <stop offset="55%" stopColor={stroke} stopOpacity="0" />
          <stop offset="84%" stopColor={stroke} stopOpacity={open ? 0.45 : 0.1} />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </radialGradient>
        {/* The rim, lit from above: white-hot at the crown, the element's own
            colour around the rest. This is what makes it read as energy rather
            than as a drawn outline. */}
        <linearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={open ? 0.95 : 0.35} />
          <stop offset="35%" stopColor={stroke} stopOpacity="1" />
          <stop offset="100%" stopColor={stroke} stopOpacity={open ? 0.85 : 0.5} />
        </linearGradient>
        {/* Through the mouth: near-black at the centre, brightening towards the
            rim, which is what gives a flat oval its sense of depth. */}
        <radialGradient id={mouthId}>
          <stop offset="0%" stopColor="#0b1020" stopOpacity={open ? 0.92 : 0.5} />
          <stop offset="70%" stopColor="#0b1020" stopOpacity={open ? 0.72 : 0.38} />
          <stop offset="100%" stopColor={stroke} stopOpacity={open ? 0.75 : 0.25} />
        </radialGradient>
      </defs>

      {/* Bloom first, so everything else sits inside the glow. */}
      <ellipse cx="12" cy="18" rx="11.9" ry="17.9" fill={`url(#${bloomId})`} />

      {/* The mouth, then the rim over it. */}
      <ellipse cx="12" cy="18" rx="7.4" ry="14.9" fill={`url(#${mouthId})`} />
      <ellipse
        cx="12"
        cy="18"
        rx="8.3"
        ry="15.8"
        fill="none"
        stroke={`url(#${rimId})`}
        strokeWidth="2.4"
      />
      {/* A hairline just inside the rim, so the ring reads as a band of energy
          with an edge rather than one stroked outline. */}
      <ellipse
        cx="12"
        cy="18"
        rx="6.8"
        ry="14.1"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={open ? 0.32 : 0.1}
        strokeWidth="0.7"
      />

      {/* Motes caught in the swirl, and the highlight where the rim catches the
          light. Static and cheap, but enough that the oval stops looking like a
          shape someone drew and starts looking like something happening. */}
      <g opacity={open ? 1 : 0.35}>
        <path
          d="M6.7 12.6 A7.4 14.2 0 0 1 10.8 3.4"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.5"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <circle cx="8.6" cy="11.5" r="0.7" fill="#ffffff" opacity="0.75" />
        <circle cx="15.4" cy="24.5" r="0.55" fill="#ffffff" opacity="0.55" />
        <circle cx="14.9" cy="14" r="0.4" fill="#ffffff" opacity="0.45" />
      </g>
    </svg>
  );
}

export function PortalFace({
  label,
  strokeColor,
  targetName,
  onEnter,
}: {
  // The portal's name. Announced and used in tooltips only — see below.
  label: string;
  strokeColor: string;
  // The linked portal's name, for the tooltip. Null when this one is unlinked.
  targetName: string | null;
  // Undefined when unlinked, or on a read-only surface with no viewport to move.
  onEnter?: () => void;
}) {
  // The name is NOT drawn: a caption across the energy read as a sticker on a
  // window, and the ring is recognisable without one. It lives in the element
  // menu (PortalMenuSection), the tooltips here, and the accessible name.
  const press = usePressWithoutDrag(onEnter);
  const face = <PortalArt stroke={strokeColor} open={!!onEnter} />;
  if (!onEnter) {
    return (
      <Tooltip
        block
        className="h-full w-full"
        title="Portal (not linked)"
        description="Right-click the portal and open Tools › Portal to pick the one it leads to."
      >
        <div className="pointer-events-auto relative h-full w-full cursor-default">{face}</div>
      </Tooltip>
    );
  }
  return (
    <Tooltip
      block
      className="h-full w-full"
      title={`Go to ${targetName ?? 'the linked portal'}`}
      description="Click to travel, or walk your Avatar-mode character into it. The link works both ways."
    >
      <button
        type="button"
        aria-label={`${label} — go to ${targetName ?? 'the linked portal'}`}
        // A click travels; a drag just moves the portal. See usePressWithoutDrag.
        {...press}
        // `relative` is load-bearing, not decoration: the hover filter and the
        // press transform each make this button a containing block, so without
        // its own positioning context the absolutely-positioned art would
        // re-parent mid-hover, collapse, drop the hover, and flicker.
        className="pointer-events-auto relative h-full w-full cursor-pointer transition duration-100 active:scale-[0.97] sm:hover:brightness-[1.12]"
      >
        {face}
      </button>
    </Tooltip>
  );
}
