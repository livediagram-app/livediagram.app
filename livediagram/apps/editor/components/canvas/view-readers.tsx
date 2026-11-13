'use client';

// The canvas's view readers (the workbench's components/canvas/view-readers), bound to this editor's zoom controls
// and minimap; the laser overlay's reader is the workbench's own.
import { createViewReaders } from '@liveworkspace/workbench/components/canvas/view-readers';
import { Minimap } from '@/components/canvas/Minimap';
import { ZoomControls } from '@/components/chrome/ZoomControls';

export { ZoomedLaserOverlay } from '@liveworkspace/workbench/components/canvas/view-readers';

export const { ViewZoomControls, ViewMinimap } = createViewReaders({ ZoomControls, Minimap });
