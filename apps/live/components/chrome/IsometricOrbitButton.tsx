'use client';

import { Tooltip } from '@/components/primitives/Tooltip';

// Orbit control for the isometric view (spec/45). Drag it to orbit the
// camera the same way Shift-drag does on the canvas — horizontal motion
// spins the azimuth, vertical motion tilts the elevation — so orbiting needs
// no held modifier. A plain click (press with no drag) snaps the camera back
// to the default isometric angle. Lives inside the zoom bar (between Fit and
// Zen) and only renders while the isometric tool is active; it reuses
// `useIsometricCamera.startOrbit` wholesale (no duplicate orbit math).

// A press that never travels more than this (px) counts as a click, not a
// drag, so a tap resets instead of nudging the camera by a stray pixel.
const CLICK_SLOP_PX = 4;

// Orbit glyph: a body at the centre with a satellite riding a tilted
// elliptical orbit around it — reads as "orbit the camera" rather than the
// flat 2D "rotate" curl.
function OrbitGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="20.2" cy="7.3" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IsometricOrbitButton({
  onOrbit,
  onReset,
}: {
  // Begin an orbit drag from the given screen coordinates. Wired to
  // `isoCamera.startOrbit`, which attaches its own window pointermove /
  // pointerup listeners and applies incremental azimuth / elevation deltas.
  onOrbit: (clientX: number, clientY: number) => void;
  // Snap the camera back to the default isometric angle. Fired on a click
  // (a press released without dragging), so the one button both orbits
  // (drag) and resets (click) without a second control.
  onReset: () => void;
}) {
  return (
    <Tooltip title="Orbit" description="Drag to orbit, click to reset the angle.">
      <button
        type="button"
        // Begin the orbit drag, and watch for a no-drag release (a tap) to
        // reset instead. The watch runs alongside startOrbit's own listeners
        // (which no-op when there's no movement). The parent zoom bar already
        // stops pointerdown propagation, so no canvas pan starts.
        onPointerDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startY = e.clientY;
          let moved = false;
          const onMove = (ev: PointerEvent) => {
            if (
              Math.abs(ev.clientX - startX) > CLICK_SLOP_PX ||
              Math.abs(ev.clientY - startY) > CLICK_SLOP_PX
            ) {
              moved = true;
            }
          };
          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (!moved) onReset();
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          onOrbit(startX, startY);
        }}
        aria-label="Orbit isometric view"
        className="flex h-9 w-9 cursor-grab items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:cursor-grabbing dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <OrbitGlyph />
      </button>
    </Tooltip>
  );
}
