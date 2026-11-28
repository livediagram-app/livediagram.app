'use client';

// Editing in the 3D view (docs/specs/008-canvas/3d-view.md "Editing in 3D"): while the canvas is mounted, sets the
// pointer-to-floor unprojection every editing gesture reads (lib/space-3d/floor-pointer.ts), through the tilt, the
// camera's turn, the zoom and the pan as they are at the moment of each pointer event.

import { useEffect, type Ref } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { setFloorPointer } from '@/lib/space-3d/floor-pointer';
import { floorPointAt } from '@/lib/space-3d/space-3d-camera';
import { space3DTiltNow } from '@/lib/space-3d/space-3d-preference';
import { space3DTurn } from '@/lib/space-3d/space-3d-turn';

export function useFloorPointer(
  mainRef: Ref<HTMLElement>,
  zoom: number,
  readOffset: () => { x: number; y: number },
): void {
  const zoomNow = useLatest(zoom);
  const offsetNow = useLatest(readOffset);
  useEffect(() => {
    setFloorPointer((clientX, clientY) => {
      const main = mainRef && 'current' in mainRef ? mainRef.current : null;
      const tilt = space3DTiltNow();
      if (!main || tilt === 0) return null;
      return floorPointAt(
        { x: clientX, y: clientY },
        main.getBoundingClientRect(),
        { zoom: zoomNow.current, offset: offsetNow.current() },
        tilt,
        undefined,
        space3DTurn.get(),
      );
    });
    return () => setFloorPointer(null);
  }, [mainRef, zoomNow, offsetNow]);
}
