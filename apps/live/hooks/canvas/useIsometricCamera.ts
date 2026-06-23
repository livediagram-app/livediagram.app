'use client';

import { useState } from 'react';
import { clampElevation, ISO_TILT_DEG } from '@/lib/isometric';

// Isometric camera (spec/45): the orbit-able angle of the isometric view.
// Local view state — like the spotlight / viewport, it never persists and is
// not synced to other participants (each viewer orbits independently).
//
// `azimuth` (rotateZ) spins the scene around the vertical; `elevation`
// (rotateX) tilts it between edge-on and top-down. `startOrbit` runs a
// self-contained drag (Shift-drag on the canvas) so it doesn't entangle the
// pan / marquee machinery: horizontal cursor motion spins the azimuth,
// vertical motion changes the elevation, both applied as incremental deltas.

const AZIMUTH_DEG_PER_PX = 0.4;
const ELEVATION_DEG_PER_PX = 0.3;

export function useIsometricCamera() {
  const [azimuth, setAzimuth] = useState<number>(ISO_TILT_DEG.z);
  const [elevation, setElevation] = useState<number>(ISO_TILT_DEG.x);

  const reset = () => {
    setAzimuth(ISO_TILT_DEG.z);
    setElevation(ISO_TILT_DEG.x);
  };

  const startOrbit = (startClientX: number, startClientY: number) => {
    let lastX = startClientX;
    let lastY = startClientY;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      // Drag right -> spin clockwise; drag up -> raise the camera (more
      // top-down). Functional updates so the incremental deltas accumulate
      // without needing a ref to the current angle.
      setAzimuth((a) => a + dx * AZIMUTH_DEG_PER_PX);
      setElevation((el) => clampElevation(el - dy * ELEVATION_DEG_PER_PX));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // The caller builds the CSS transform via isoTransform(azimuth, elevation,
  // pivot): the pivot depends on the content bounds + viewport size, which
  // live in the canvas, not here. Exposing the raw angles keeps this hook
  // free of any layout knowledge.
  return { azimuth, elevation, startOrbit, reset };
}
