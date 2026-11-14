'use client';

import { createEraserPanel } from '@liveworkspace/workbench/components/panels/EraserPanel';
import { eraserRadius, ERASER_MODES, ERASER_SIZES, ERASER_TARGETS } from '@/lib/eraser-config';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

// The Eraser Panel (docs/specs/008-canvas/eraser-panel.md), shared by the editors and bound to this one's mode-panel
// chrome and eraser settings.
export const EraserPanel = createEraserPanel<ModePanelProps>({
  ModePanel,
  eraserRadius,
  ERASER_MODES,
  ERASER_SIZES,
  ERASER_TARGETS,
});
